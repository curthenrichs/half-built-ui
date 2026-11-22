/* Engine smoke: every demo page in Chromium, Firefox, and WebKit
   through Playwright, at a phone width. Playwright ships current
   engines, so this catches engine differences, not age: the stylelint
   preset's browser-floor lint is what holds the floor. Gated behind
   BROWSER_TESTS=1 like browser.test.ts, and run through the site
   workspace's test:browser script for the same reason (startPreview
   spawns astro preview in the working directory). Needs
   `npx playwright install chromium firefox webkit` once. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium, firefox, webkit } from "playwright";
import type { Browser, BrowserType } from "playwright";
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

    it.each(PAGES)(`${name} renders %s`, async (path) => {
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
    });
  });
});
