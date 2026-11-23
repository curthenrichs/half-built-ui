/* Engine smoke: every demo page in Chromium, Firefox, and WebKit
   through Playwright, at a phone width. Playwright ships current
   engines, so this catches engine differences, not age: the stylelint
   preset's browser-floor lint is what holds the floor. A second block
   holds the page's image requests open to check the image loading
   state each engine paints, page and lightbox. Gated behind
   BROWSER_TESTS=1 like browser.test.ts, and run through the site
   workspace's test:browser script for the same reason (startPreview
   spawns astro preview in the working directory). Needs
   `npx playwright install chromium firefox webkit` once. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium, firefox, webkit } from "playwright";
import type {
  Browser,
  BrowserContext,
  BrowserType,
  Page,
  Route,
} from "playwright";
import {
  startPreview,
  stopPreview,
} from "@half-built/tooling/test-kit/browser-server.ts";

const enabled = process.env.BROWSER_TESTS === "1";

const PORT = 4329;
const ORIGIN = `http://localhost:${PORT}`;
const WIDTH = 390;

const PAGES = [
  "/",
  "/search/",
  "/privacy/",
  "/accessibility/",
  "/terms/",
  "/2026/09/01/sample-published/",
  "/404.html",
];

const ENGINES: [string, BrowserType][] = [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
];

const ECOSYSTEM_FIXTURE = readFileSync(
  new URL("./fixtures/ecosystem.json", import.meta.url),
  "utf-8",
);

describe.skipIf(!enabled)("engine smoke", () => {
  let server: ChildProcess | undefined;

  beforeAll(async () => {
    server = await startPreview(PORT, "/");
  }, 90_000);

  afterAll(() => {
    stopPreview(server);
  });

  describe.each(ENGINES)("%s", (name, engine) => {
    let browser: Browser | undefined;

    beforeAll(async () => {
      browser = await engine.launch();
    }, 60_000);

    afterAll(async () => {
      await browser?.close();
    });

    it.each(PAGES)(
      `${name} renders %s`,
      async (path) => {
        if (!browser) throw new Error(`no ${name} (beforeAll failed)`);

        const context = await browser.newContext({
          viewport: { width: WIDTH, height: 844 },
        });

        try {
          const page = await context.newPage();
          const errors: string[] = [];

          page.on("pageerror", (err) => errors.push(err.message));

          page.on("console", (msg) => {
            if (msg.type() === "error") errors.push(msg.text());
          });

          /* The footer's ecosystem island fetches a live endpoint; the
           fixture keeps the run offline and deterministic. */
          await page.route("**/ecosystem.json", (route) =>
            route.fulfill({
              status: 200,
              contentType: "application/json",
              headers: { "access-control-allow-origin": "*" },
              body: ECOSYSTEM_FIXTURE,
            }),
          );

          await page.goto(`${ORIGIN}${path}`, { waitUntil: "networkidle" });

          for (const selector of ["header", "main", "footer"]) {
            const box = await page.locator(selector).first().boundingBox();

            expect(box?.width, `${selector} width`).toBeGreaterThan(0);
            expect(box?.height, `${selector} height`).toBeGreaterThan(0);
          }

          /* The tokens sit in a cascade layer: a browser that dropped
           layered CSS would leave this custom property unset. */
          const surface = await page.evaluate(() =>
            getComputedStyle(document.documentElement)
              .getPropertyValue("--surface")
              .trim(),
          );

          expect(surface, "layered tokens applied").not.toBe("");

          const scrollWidth = await page.evaluate(
            () => document.documentElement.scrollWidth,
          );

          expect(scrollWidth, "no sideways scroll").toBeLessThanOrEqual(WIDTH);
          expect(errors).toEqual([]);
        } finally {
          await context.close();
        }
      },
      30_000,
    );

    /* The color-mix tints sit behind @supports; a wrong query would
       drop every tint in every browser and still pass the floor suite,
       which only sees the plain grounds. Current engines have
       color-mix, so each tinted box must paint something other than
       its own plain ground, at rest and, where it tints on hover,
       under the pointer. */
    const TINTS: [selector: string, plain: string][] = [
      [".press-box-accent", "--surface"],
      [".press-box-shaded", "--hairline"],
      [".site-description", "--surface"],
      [".site-knob > summary", "--surface"],
    ];

    const HOVER_TINTS = [".press-box-accent", ".site-knob > summary"];

    it(`${name} paints the color-mix tints, at rest and on hover`, async () => {
      if (!browser) throw new Error(`no ${name} (beforeAll failed)`);

      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });

      try {
        const page = await context.newPage();
        await page.goto(`${ORIGIN}/`, { waitUntil: "networkidle" });

        const grounds = await page.evaluate((tints) => {
          const resolve = (token: string): string => {
            const probe = document.createElement("span");
            probe.style.backgroundColor = `var(${token})`;
            document.body.append(probe);
            const value = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return value;
          };

          return tints.map(([s, token]) => {
            const el = document.querySelector(s);

            return {
              s,
              plain: resolve(token),
              ground: el ? getComputedStyle(el).backgroundColor : "missing",
            };
          });
        }, TINTS);

        for (const { s, plain, ground } of grounds) {
          expect(ground, s).not.toBe("missing");
          expect(ground, s).not.toBe(plain);
        }

        for (const selector of HOVER_TINTS) {
          const rest = await page.$eval(
            selector,
            (el) => getComputedStyle(el).backgroundColor,
          );

          await page.hover(selector);

          /* .press-box eases its ground over 0.1s; wait it out. */
          await page.waitForFunction(
            ([sel, before]) => {
              const el = document.querySelector(sel);
              return el
                ? getComputedStyle(el).backgroundColor !== before
                : false;
            },
            [selector, rest] as const,
            { timeout: 2000 },
          );

          await page.mouse.move(0, 0);
        }
      } finally {
        await context.close();
      }
    }, 30_000);
  });

  /* The image loading state (mountImageLoading, and the lightbox's
     reuse of it) across engines. Holding the page's image requests
     open keeps every frame loading for as long as a check needs; the
     unit suite owns the grace-period timing, this owns what each
     engine paints. */
  describe.each(ENGINES)("%s image loading", (name, engine) => {
    let browser: Browser | undefined;

    beforeAll(async () => {
      browser = await engine.launch();
    }, 60_000);

    afterAll(async () => {
      await browser?.close();
    });

    /* Built images live under /_astro/; nothing else is held. */
    async function holdImages(page: Page): Promise<() => Promise<void>> {
      const held: Route[] = [];
      let open = false;

      await page.route(
        "**/_astro/*.{webp,avif,png,jpg,jpeg,gif,svg}",
        (route) => {
          if (open) return route.continue();
          held.push(route);
        },
      );

      return async () => {
        open = true;
        await Promise.all(held.splice(0).map((r) => r.continue()));
      };
    }

    async function openHeld(
      reducedMotion: "reduce" | "no-preference" = "no-preference",
    ): Promise<{
      context: BrowserContext;
      page: Page;
      release: () => Promise<void>;
    }> {
      if (!browser) throw new Error(`no ${name} (beforeAll failed)`);

      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        reducedMotion,
      });

      const page = await context.newPage();

      await page.route("**/ecosystem.json", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: ECOSYSTEM_FIXTURE,
        }),
      );

      const release = await holdImages(page);
      await page.goto(`${ORIGIN}/`, { waitUntil: "domcontentloaded" });
      return { context, page, release };
    }

    /* The first real (not the demo specimen's) frame still loading. */
    const TARGET = ".img-frame[data-loading]:not(.demo-img-loading)";

    /* Samples the target's three dots every 100ms across one 2s loop
       and reports, per dot, whether it was ever hidden. */
    async function dotsEverHidden(page: Page): Promise<boolean[]> {
      return page.evaluate(async (target) => {
        const frame = document.querySelector(target);

        const dots = [
          ...(frame?.querySelectorAll(".img-loading-dots i") ?? []),
        ];

        const hidden = dots.map(() => false);

        for (let t = 0; t < 21; t++) {
          dots.forEach((d, i) => {
            if (getComputedStyle(d).visibility === "hidden") hidden[i] = true;
          });

          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        return hidden;
      }, TARGET);
    }

    it(`${name}: a held image shows the centered label, steps its dots, and clears on load`, async () => {
      const { context, page, release } = await openHeld();

      try {
        await page.waitForSelector(TARGET, { timeout: 5000 });

        await page.waitForFunction(
          (target) => {
            const label = document.querySelector(`${target} > .img-loading`);
            return label ? getComputedStyle(label).opacity === "1" : false;
          },
          TARGET,
          { timeout: 5000 },
        );

        const geometry = await page.$eval(TARGET, (frame) => {
          const label = frame.querySelector(".img-loading");
          const range = document.createRange();
          if (label) range.selectNodeContents(label);
          const f = frame.getBoundingClientRect();
          const t = range.getBoundingClientRect();

          return {
            dx: Math.abs(f.left + f.width / 2 - (t.left + t.width / 2)),
            dy: Math.abs(f.top + f.height / 2 - (t.top + t.height / 2)),
            text: label?.textContent ?? "",
            img: getComputedStyle(frame.querySelector("img") ?? frame).opacity,
          };
        });

        expect(geometry.text).toBe("$>Loading...");
        expect(geometry.dx, "label centered across").toBeLessThanOrEqual(2);
        expect(geometry.dy, "label centered down").toBeLessThanOrEqual(2);

        expect(Number(geometry.img), "image held transparent").toBeLessThan(
          0.01,
        );

        expect(await dotsEverHidden(page)).toEqual([true, true, true]);

        /* Tag the frame so it can be found once its mark clears. */
        await page.$eval(TARGET, (frame) => {
          frame.setAttribute("data-engine-target", "");
          frame.scrollIntoView();
        });

        await release();
        const target = "[data-engine-target]";

        await page.waitForFunction(
          (sel) => !document.querySelector(sel)?.hasAttribute("data-loading"),
          target,
          { timeout: 10_000 },
        );

        await page.waitForFunction(
          (sel) => {
            const img = document.querySelector(`${sel} > img`);
            return img ? getComputedStyle(img).opacity === "1" : false;
          },
          target,
          { timeout: 5000 },
        );

        await page.waitForFunction(
          (sel) => !document.querySelector(`${sel} > .img-loading`),
          target,
          { timeout: 2000 },
        );
      } finally {
        await context.close();
      }
    }, 30_000);

    it(`${name}: under reduced motion a held image's dots hold at three`, async () => {
      const { context, page } = await openHeld("reduce");

      try {
        await page.waitForSelector(TARGET, { timeout: 5000 });
        expect(await dotsEverHidden(page)).toEqual([false, false, false]);
      } finally {
        await context.close();
      }
    }, 30_000);

    it(`${name}: the lightbox viewbox shows the loading state while its image is held`, async () => {
      const { context, page, release } = await openHeld();

      try {
        await page.waitForSelector("a.lightbox-link[data-island-lightbox]", {
          timeout: 5000,
        });

        await page.locator("a.lightbox-link").first().click();

        await page.waitForSelector(".lb-viewbox[data-loading]", {
          timeout: 5000,
        });

        await release();

        await page.waitForFunction(
          () =>
            !document
              .querySelector(".lb-viewbox")
              ?.hasAttribute("data-loading"),
          undefined,
          { timeout: 10_000 },
        );
      } finally {
        await context.close();
      }
    }, 30_000);
  });
});
