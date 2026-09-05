/* Browser suite (Task 7): axe against the built dist in both themes,
   plus the three DOM-contract smokes from Task 5's palette editor and
   Task 4's toc (jsdom cannot see real CSS cascade, so the "does the
   page actually repaint" and "is this WCAG AA clean" questions need a
   real browser). Gated behind BROWSER_TESTS=1 so plain `npm test`
   never needs Chrome or a built site: describe.skipIf still calls the
   suite factory to register the (skipped) tests, but a skipped suite
   runs neither its hooks nor its bodies, so beforeAll never launches a
   server or a browser. Run with `BROWSER_TESTS=1 npm run test:browser`
   after `npm run build:site` at the repo root: the root script
   delegates to this workspace (`npm run test:browser --workspace site`)
   rather than pointing vitest at this file directly, because
   startPreview (test-kit/browser-server.ts) spawns `npx astro preview`
   with no explicit cwd, and an npm workspace child process is the only
   thing that puts that cwd at site/ (where astro.config.mjs and dist
   live) instead of the monorepo root. */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import type { ChildProcess } from "node:child_process";
import type { Browser, Page } from "puppeteer-core";
import { AxePuppeteer } from "@axe-core/puppeteer";
import type { RunOptions } from "axe-core";
import { startPreview, stopPreview, launchChrome, desktopPage } from "@half-built/tooling/test-kit/browser-server.ts";
import { SECTIONS } from "../src/data/sections";

const enabled = process.env.BROWSER_TESTS === "1";

const PORT = 4327;
const ORIGIN = `http://localhost:${PORT}`;

/* The one demo-token-chip whose inline style paints --accent-1 exactly
   (index.astro's CSS-primitives section): a real rendered element that
   the palette editor must actually repaint, not just the custom
   property it sets. The attribute selector matches the literal string
   Astro emits for a plain string style attribute, so it is exact. */
const ACCENT_1_CHIP = '.demo-token-chip[style="background-color:var(--accent-1)"]';

/* WCAG 2.1 A and AA, matching the accessibility target the design
   spec names elsewhere in this repo. Best-practice rules are left out
   so a failure here always maps to a success criterion. */
const RUN: RunOptions = {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  resultTypes: ["violations"],
};

interface Violation {
  id: string;
  impact: string | null | undefined;
  help: string;
  helpUrl: string;
  targets: string[];
}

async function runAxe(page: Page): Promise<Violation[]> {
  const results = await new AxePuppeteer(page).options(RUN).analyze();
  return results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    helpUrl: v.helpUrl,
    /* First few offenders by selector: enough to find them, short
       enough that a page-wide miss does not print every node. */
    targets: v.nodes.slice(0, 5).map((n) => n.target.map(String).join(" ")),
  }));
}

function report(theme: string, violations: Violation[]): string {
  const lines = violations.map((v) =>
    `  ${v.id} [${v.impact ?? "?"}] ${v.help}\n    ${v.helpUrl}\n${v.targets.map((t) => `    - ${t}`).join("\n")}`);
  return `/ (${theme}) axe violations:\n${lines.join("\n")}`;
}

describe.skipIf(!enabled)("browser suite", () => {
  let browser: Browser | undefined;
  let server: ChildProcess | undefined;
  let page: Page | undefined;

  beforeAll(async () => {
    server = await startPreview(PORT, "/");
    browser = await launchChrome();
  }, 90_000);

  afterAll(async () => {
    try {
      await browser?.close();
    } finally {
      stopPreview(server);
    }
  });

  afterEach(async () => {
    await page?.close();
    page = undefined;
  });

  /* networkidle0, not domcontentloaded: the toc, theme toggle, and
     palette editor all mount from a module script with no DOM marker
     to wait on. */
  async function open(): Promise<Page> {
    if (!browser) throw new Error("no browser (beforeAll failed)");
    const p = await desktopPage(browser);
    page = p;
    await p.goto(`${ORIGIN}/`, { waitUntil: "networkidle0" });
    /* No test inherits another's persisted palette or theme: each one
       starts from a clean localStorage, not whatever a prior test in
       this file left behind. */
    await p.evaluate(() => { localStorage.clear(); });
    /* Colors must be settled when axe reads them: a theme flip mid
       transition can interpolate a color past its passing endpoint. */
    await p.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
    return p;
  }

  it("has no WCAG 2.1 AA violations in the light theme", async () => {
    const p = await open();
    /* Light is forced, not assumed: the head stamp follows
       prefers-color-scheme when nothing is stored, so on a
       dark-preference machine the page would otherwise arrive dark
       and an unforced "light" pass would audit dark twice. */
    await p.evaluate(() => { delete document.documentElement.dataset.theme; });
    const violations = await runAxe(p);
    expect(violations, report("light", violations)).toEqual([]);
  }, 60_000);

  it("has no WCAG 2.1 AA violations in the dark theme", async () => {
    const p = await open();
    await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
    /* One rAF tick so the dark token layer's cascade has actually
       applied before axe reads computed colors. */
    await p.evaluate(async () => {
      await new Promise((resolve) => { requestAnimationFrame(resolve); });
    });
    const violations = await runAxe(p);
    expect(violations, report("dark", violations)).toEqual([]);
  }, 60_000);

  it("dispatching an input on base 1 repaints --brand-1-500 and a rendered accent element", async () => {
    const p = await open();
    await p.click("[data-palette-editor] summary");
    await p.waitForSelector(ACCENT_1_CHIP);
    const before = await p.$eval(ACCENT_1_CHIP, (el) => getComputedStyle(el).backgroundColor);

    await p.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('input[data-palette-base="1"]');
      if (!input) throw new Error("no base-1 input");
      input.value = "#2f9e44";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const brand1500 = await p.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--brand-1-500").trim());
    expect(brand1500).toBe("#2f9e44");

    const after = await p.$eval(ACCENT_1_CHIP, (el) => getComputedStyle(el).backgroundColor);
    expect(after, "the accent-1 chip's painted color never changed").not.toBe(before);
  }, 30_000);

  it("the copyable css block declares exactly the six --brand-* custom properties", async () => {
    const p = await open();
    const text = await p.$eval("[data-palette-css]", (el) => el.textContent);
    expect(text).toMatch(/^:root \{$/m);
    const names = [...text.matchAll(/^\s*(--brand-[a-z0-9-]+):/gm)].map((m) => m[1]);
    expect(new Set(names)).toEqual(new Set([
      "--brand-1-500",
      "--brand-1-600",
      "--brand-1-700",
      "--brand-2-300",
      "--brand-2-500",
      "--brand-2-700",
    ]));
    expect(names).toHaveLength(6);
  }, 30_000);

  it("the toc renders one link per section and every href target exists", async () => {
    const p = await open();
    const hrefs = await p.$$eval('aside.site-toc nav[aria-label="Sections"] a', (els) =>
      els.map((el) => el.getAttribute("href") ?? ""));
    expect(hrefs).toEqual(SECTIONS.map((s) => `#${s.id}`));
    const missing = await p.evaluate((ids: string[]) =>
      ids.filter((id) => document.getElementById(id) === null), SECTIONS.map((s) => s.id));
    expect(missing, `toc targets missing from the page: ${missing.join(", ")}`).toEqual([]);
  }, 30_000);
});
