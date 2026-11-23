/* The demo in browsers at the support floor (@half-built/tooling's
   browser-floor): Chromium 99 from Playwright 1.18, Firefox 98 and
   WebKit 15.4 from Playwright 1.21. The engine suite in site/test runs
   current builds; this runs the old ones, so it is the check that the
   pages, the color-mix fallbacks, and the image loading state hold at
   the floor itself. None of these engines has color-mix, so every
   fallback ground is what they paint.

   Serves site/dist (build the site first) from its own small server,
   so it needs only this folder's install. Run from site/floor:
     npm ci && npm run install-browsers && npm test */
/* Node's URL, and the page globals the evaluate() callbacks run with
   in the browser: */
/* global URL, document, window, getComputedStyle, requestAnimationFrame, setTimeout, CSS */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { firefox, webkit } from "playwright";
import { chromium } from "playwright-chromium-99";

const require = createRequire(import.meta.url);
const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const AXE = require.resolve("axe-core/axe.min.js");

const ECOSYSTEM_FIXTURE = await readFile(
  new URL("../test/fixtures/ecosystem.json", import.meta.url),
  "utf-8",
);

const FLOOR = JSON.parse(
  await readFile(
    new URL("../../packages/tooling/src/browser-floor.json", import.meta.url),
    "utf-8",
  ),
);

/* Each engine against its floor entry: a release bump that changes a
   bundled engine fails here, not silently. */
const ENGINES = [
  ["chromium", chromium, FLOOR.chrome],
  ["firefox", firefox, FLOOR.firefox],
  ["webkit", webkit, FLOOR.safari],
];

const PAGES = [
  "/",
  "/search/",
  "/privacy/",
  "/accessibility/",
  "/terms/",
  "/2026/09/01/sample-published/",
  "/404.html",
];

/* The rules whose color-mix tints sit behind @supports over a plain
   ground (the fallback contrast test in packages/tooling names the
   same set). Only the boxes rendered at a width are checked there. */
const FALLBACKS = [
  ".press-box-accent",
  ".press-box-shaded",
  ".toc-inline-summary",
  ".site-description",
  ".site-knob > summary",
  '.site-toolbar-presets button[aria-pressed="true"]',
];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".xml": "application/xml",
  ".woff2": "font/woff2",
};

/* A static server over dist: a directory serves its index.html, and a
   missing path serves 404.html with a 404, as Cloudflare Pages does. */
async function serve() {
  const server = createServer(async (req, res) => {
    const path = normalize(
      decodeURIComponent(new URL(req.url, "http://x").pathname),
    );

    let file = join(DIST, path);

    try {
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      const body = await readFile(file);

      res.writeHead(200, {
        "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      });

      res.end(body);
    } catch {
      res.writeHead(404, { "content-type": TYPES[".html"] });
      res.end(await readFile(join(DIST, "404.html")));
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server;
}

async function openPage(browser, origin, path, options = {}) {
  const context = await browser.newContext({
    viewport: { width: options.width ?? 390, height: 844 },
    reducedMotion: options.reducedMotion ?? "no-preference",
  });

  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.route("**/ecosystem.json", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: ECOSYSTEM_FIXTURE,
    }),
  );

  let release = async () => {};

  if (options.holdImages) {
    const held = [];
    let open = false;

    await page.route(
      "**/_astro/*.{webp,avif,png,jpg,jpeg,gif,svg}",
      (route) => {
        if (open) return route.continue();
        held.push(route);
      },
    );

    release = async () => {
      open = true;
      await Promise.all(held.splice(0).map((r) => r.continue()));
    };
  }

  await page.goto(`${origin}${path}`, {
    waitUntil: options.holdImages ? "domcontentloaded" : "networkidle",
  });

  return { context, page, errors, release };
}

/* axe's contrast rule over the fallback boxes that are rendered. */
async function contrastViolations(page) {
  await page.addScriptTag({ path: AXE });

  return page.evaluate(async (selectors) => {
    const include = selectors
      .flatMap((s) => [...document.querySelectorAll(s)])
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => [el]);

    if (include.length === 0) return ["no fallback box rendered"];

    const result = await window.axe.run(
      { include },
      { runOnly: ["color-contrast"] },
    );

    return result.violations.flatMap((v) =>
      v.nodes.map((n) => `${n.target.join(" ")}: ${n.failureSummary}`),
    );
  }, FALLBACKS);
}

async function setTheme(page, theme) {
  await page.evaluate(async (t) => {
    document.documentElement.dataset.theme = t;
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }, theme);
}

/* Samples one frame's three dots every 100ms across one 2s loop and
   reports, per dot, whether it was ever hidden. */
async function dotsEverHidden(page, frame) {
  return page.evaluate(async (sel) => {
    const dots = [
      ...(document
        .querySelector(sel)
        ?.querySelectorAll(".img-loading-dots i") ?? []),
    ];

    const hidden = dots.map(() => false);

    for (let t = 0; t < 21; t++) {
      dots.forEach((d, i) => {
        if (getComputedStyle(d).visibility === "hidden") hidden[i] = true;
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return hidden;
  }, frame);
}

const TARGET = ".img-frame[data-loading]:not(.demo-img-loading)";

let server;
let origin;

before(async () => {
  server = await serve();
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server?.close();
});

for (const [name, engine, floor] of ENGINES) {
  describe(`${name} at the floor`, () => {
    let browser;

    before(async () => {
      browser = await engine.launch();
    });

    after(async () => {
      await browser?.close();
    });

    test(`${name} is version ${floor} and has no color-mix`, async () => {
      const major = browser
        .version()
        .split(".")
        .slice(0, floor.includes(".") ? 2 : 1)
        .join(".");

      assert.equal(major, floor);

      const { context, page } = await openPage(browser, origin, "/");

      try {
        const colorMix = await page.evaluate(() =>
          CSS.supports("background", "color-mix(in srgb, red, blue)"),
        );

        assert.equal(colorMix, false, "fallbacks are what this engine paints");
      } finally {
        await context.close();
      }
    });

    for (const path of PAGES) {
      test(`${name} renders ${path}`, async () => {
        const { context, page, errors } = await openPage(browser, origin, path);

        try {
          for (const selector of ["header", "main", "footer"]) {
            const box = await page.locator(selector).first().boundingBox();

            assert.ok(
              box && box.width > 0 && box.height > 0,
              `${selector} has a box`,
            );
          }

          const surface = await page.evaluate(() =>
            getComputedStyle(document.documentElement)
              .getPropertyValue("--surface")
              .trim(),
          );

          assert.notEqual(surface, "", "layered tokens applied");

          const scrollWidth = await page.evaluate(
            () => document.documentElement.scrollWidth,
          );

          assert.ok(
            scrollWidth <= 390,
            `no sideways scroll (${scrollWidth}px)`,
          );

          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      });
    }

    for (const width of [390, 1280]) {
      test(`${name} fallback boxes hold AA contrast at ${width}px, both themes, rest and hover`, async () => {
        const { context, page } = await openPage(browser, origin, "/", {
          width,
        });

        try {
          for (const theme of ["light", "dark"]) {
            await setTheme(page, theme);

            const grounds = await page.evaluate(
              (selectors) =>
                selectors.flatMap((s) =>
                  [...document.querySelectorAll(s)]
                    .filter((el) => el.getClientRects().length > 0)
                    .map((el) => [s, getComputedStyle(el).backgroundColor]),
                ),
              FALLBACKS,
            );

            for (const [selector, ground] of grounds) {
              assert.notEqual(
                ground,
                "rgba(0, 0, 0, 0)",
                `${theme} ${selector} paints a ground`,
              );
            }

            assert.deepEqual(
              await contrastViolations(page),
              [],
              `${theme} at rest`,
            );

            for (const selector of FALLBACKS) {
              const el = page.locator(selector).first();
              if (!(await el.isVisible())) continue;
              await el.hover();

              /* axe resolves a transparent box against the surface
                 behind it and passes, so the ground is checked too. */
              assert.notEqual(
                await el.evaluate((e) => getComputedStyle(e).backgroundColor),
                "rgba(0, 0, 0, 0)",
                `${theme} hovering ${selector} paints a ground`,
              );

              assert.deepEqual(
                await contrastViolations(page),
                [],
                `${theme} hovering ${selector}`,
              );
            }

            await page.mouse.move(0, 0);
          }
        } finally {
          await context.close();
        }
      });
    }

    test(`${name} shows the image loading state: isolated frame, centered label, stepping dots, cleared on load`, async () => {
      const { context, page, release } = await openPage(browser, origin, "/", {
        width: 1280,
        holdImages: true,
      });

      try {
        await page.waitForSelector(TARGET, { timeout: 5000 });

        await page.waitForFunction(
          (sel) => {
            const label = document.querySelector(`${sel} > .img-loading`);
            return label ? getComputedStyle(label).opacity === "1" : false;
          },
          TARGET,
          { timeout: 5000 },
        );

        const m = await page.$eval(TARGET, (frame) => {
          const label = frame.querySelector(".img-loading");
          const range = document.createRange();
          range.selectNodeContents(label);
          const f = frame.getBoundingClientRect();
          const t = range.getBoundingClientRect();

          return {
            isolation: getComputedStyle(frame).isolation,
            dx: Math.abs(f.left + f.width / 2 - (t.left + t.width / 2)),
            dy: Math.abs(f.top + f.height / 2 - (t.top + t.height / 2)),
          };
        });

        assert.equal(m.isolation, "isolate");

        assert.ok(
          m.dx <= 2 && m.dy <= 2,
          `label centered (off by ${m.dx}, ${m.dy})`,
        );

        assert.deepEqual(await dotsEverHidden(page, TARGET), [
          true,
          true,
          true,
        ]);

        /* Tag the frame so it can be found once its mark clears, then
           let the images through: the mark, the label, and the image's
           hold all go. */
        await page.$eval(TARGET, (frame) => {
          frame.setAttribute("data-floor-target", "");
          frame.scrollIntoView();
        });

        await release();

        await page.waitForFunction(
          () => {
            const frame = document.querySelector("[data-floor-target]");
            const img = frame?.querySelector("img");

            return (
              frame !== null &&
              !frame.hasAttribute("data-loading") &&
              !frame.querySelector(".img-loading") &&
              img !== null &&
              img !== undefined &&
              getComputedStyle(img).opacity === "1"
            );
          },
          undefined,
          { timeout: 15_000 },
        );
      } finally {
        await context.close();
      }
    });

    test(`${name} holds the loading dots at three under reduced motion`, async () => {
      const { context, page } = await openPage(browser, origin, "/", {
        width: 1280,
        holdImages: true,
        reducedMotion: "reduce",
      });

      try {
        await page.waitForSelector(TARGET, { timeout: 5000 });

        assert.deepEqual(await dotsEverHidden(page, TARGET), [
          false,
          false,
          false,
        ]);
      } finally {
        await context.close();
      }
    });
  });
}
