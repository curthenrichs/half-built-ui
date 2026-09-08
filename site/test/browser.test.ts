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

/* The token sheet's accent-1 chip (the Palette table in index.astro's
   CSS-primitives section): a real rendered element that the palette
   editor must actually repaint, not just the custom property it sets.
   The attribute selector matches the literal string the Palette
   component emits for a token entry, so it is exact. */
const ACCENT_1_CHIP = '.palette-chip[style="background-color:var(--accent-1)"]';

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
    /* No test inherits another's persisted palette or theme: the clear
       must run BEFORE the page's scripts, because the editor applies a
       stored palette at mount; a post-goto clear would leave the prior
       test's palette painted and only the storage empty. */
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.clear();
      } catch {
        /* storage unavailable; nothing persisted to clear */
      }
    });
    await p.goto(`${ORIGIN}/`, { waitUntil: "networkidle0" });
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

    /* the token sheet's hex readout follows the pick (token-hexes.ts
       refreshes on the html style mutation, an async observer tick) */
    await p.waitForFunction(() =>
      document.querySelector('[data-token-hex="--accent-1"]')?.textContent === "#2f9e44");
  }, 30_000);

  it("the copyable css block declares exactly the twelve override properties", async () => {
    const p = await open();
    /* Same two-type-worlds note as palette-editor.ts's copy handler:
       strict DOM sees string | null, the lint project sees string. */
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const text = await p.$eval("[data-palette-css]", (el) => el.textContent ?? "");
    expect(text).toMatch(/^:root \{$/m);
    const names = [...text.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]);
    expect(new Set(names)).toEqual(new Set([
      "--brand-1-300",
      "--brand-1-500",
      "--brand-1-vivid",
      "--brand-1-600",
      "--brand-1-700",
      "--brand-2-300",
      "--brand-2-500",
      "--brand-2-700",
      "--code-bg",
      "--code-line",
      "--code-fg",
      "--code-token-comment",
    ]));
    expect(names).toHaveLength(12);
  }, 30_000);

  it("applying a preset recolors a highlighted keyword span and the code block's ground", async () => {
    const p = await open();
    /* The code-vars transformer emits var(--code-token-keyword) on
       keyword spans and var(--code-bg) on the pre at build; both
       variables derive from accent 1, so an applied palette must
       repaint real syntax and the island's own ground. */
    const KEYWORD_SPAN = '.code-block span[style*="--code-token-keyword"]';
    const PRE = ".code-block pre";
    await p.waitForSelector(KEYWORD_SPAN);
    const before = await p.$eval(KEYWORD_SPAN, (el) => getComputedStyle(el).color);
    const beforeBg = await p.$eval(PRE, (el) => getComputedStyle(el).backgroundColor);

    await p.click("[data-palette-editor] summary");
    await p.click('[data-palette-preset][data-base-1="#2f9e44"]');

    const after = await p.$eval(KEYWORD_SPAN, (el) => getComputedStyle(el).color);
    expect(after, "the keyword span's painted color never changed").not.toBe(before);
    const afterBg = await p.$eval(PRE, (el) => getComputedStyle(el).backgroundColor);
    expect(afterBg, "the code ground's painted color never changed").not.toBe(beforeBg);
  }, 30_000);

  it("only the forced demo editor note reaches the built page", async () => {
    const p = await open();
    /* EditorNote defaults to dev-server-only, and the preview server
       serves a real build: the page's two real notes must be absent,
       while the Content section's shown={true} demo instance is the
       one that may (and must) render. The text checks catch a leaked
       real note and any plain-text marker regression. */
    const notes = await p.$$eval(".editor-note", (els) => els.length);
    expect(notes).toBe(1);
    const html = await p.content();
    expect(html).not.toContain("Curt has to supply");
    expect(html).not.toContain("Curt fill in");
  }, 30_000);

  it("the icon set is wired in the head and every icon resolves", async () => {
    const p = await open();
    const hrefs = await p.$$eval('link[rel="icon"], link[rel="apple-touch-icon"]', (els) =>
      els.map((el) => el.getAttribute("href") ?? ""));
    expect(new Set(hrefs)).toEqual(new Set(["/favicon.svg", "/favicon-32.png", "/apple-touch-icon.png"]));
    for (const href of hrefs) {
      const status = await p.evaluate(async (h: string) => (await fetch(h)).status, href);
      expect(status, `${href} did not resolve`).toBe(200);
    }
  }, 30_000);

  it("jumping to a section marks that same section in the toc", async () => {
    const p = await open();
    /* The anchor puts the target's top at the viewport top, above the
       scroll-spy band, so before the 2026-09-06 fix a short section
       (Frame) handed the highlight to the next one down. */
    for (const section of SECTIONS) {
      await p.evaluate((id: string) => {
        location.hash = "";
        location.hash = id;
      }, section.id);
      await p.waitForFunction(
        (title: string) =>
          document.querySelector('.site-rail-toc a[aria-current="true"]')?.textContent === title,
        { timeout: 5000 },
        section.title,
      );
    }
  }, 60_000);

  it("the footer's ecosystem list carries the island's hook and the baseline", async () => {
    const p = await open();
    /* The hook is what mountEcosystem finds. The baseline is what
       renders with JavaScript off forever, and what stands whenever
       the endpoint cannot be reached: this site plus a pointer home
       to the blog.

       The endpoint is blocked rather than fetched. Since it went live
       the island would otherwise replace this list with the real
       document, making the assertion depend on a third-party host
       being up and on the contents of a file in another repo. Blocking
       it tests the fallback path, which is the load-bearing promise,
       and keeps the suite hermetic. The fetch-and-replace path is
       covered against fixtures in ecosystem-dom.test.ts. */
    await p.setRequestInterception(true);
    p.on("request", (req) => {
      void (req.url().includes("ecosystem.json") ? req.abort() : req.continue());
    });
    await p.reload({ waitUntil: "networkidle0" });
    const list = await p.$("footer [data-ecosystem]");
    expect(list, "the footer has no data-ecosystem hook").not.toBeNull();
    /* Same two-type-worlds note as palette-editor.ts's copy handler:
       strict DOM sees string | null, the lint project sees string. */
    const items = await p.$$eval("footer [data-ecosystem] li", (els) =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      els.map((el) => el.textContent?.trim() ?? ""));
    expect(items).toEqual(["half-built-ui", "Half-Built Robots"]);
    const self = await p.$$eval("footer [data-ecosystem] .footer-sitemap-self", (els) =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      els.map((el) => el.textContent?.trim() ?? ""));
    expect(self).toEqual(["half-built-ui"]);
  }, 30_000);

  it("the swapped ecosystem list keeps the footer's own styling", async () => {
    /* The complement to the test above. That one blocks the endpoint
       and checks the baseline; this one answers with a fixture and
       checks what the island builds, so neither touches the network.

       Computed styles, not classes: 0.3.0 shipped an island whose
       markup and classes were correct and whose rendering was not,
       because Astro scopes Footer.astro's rules to a data-astro-cid
       attribute that createElement nodes never carried. Asserting the
       class would have passed straight through the bug. */
    const doc = JSON.stringify({
      version: 1,
      updated: "2026-09-07",
      entries: [
        { key: "blog", label: "Half-Built Robots", href: "https://half-built-robots.com/", priority: 0, family: "half-built" },
        { key: "beadz", label: "The Bead Reserve", href: null, priority: 1, family: "half-built" },
        { key: "ui", label: "half-built-ui", href: null, priority: 3, family: "half-built" },
      ],
    });
    const p = await open();
    await p.setRequestInterception(true);
    p.on("request", (req) => {
      void (req.url().includes("ecosystem.json")
        ? req.respond({
            status: 200,
            contentType: "application/json",
            /* The stub is cross-origin exactly as the real endpoint is,
               so it needs the same CORS header. Without it the fetch
               fails and the island falls back to the baseline, which
               made this test look like a swap bug rather than a stub
               missing a header. */
            headers: { "Access-Control-Allow-Origin": "*" },
            body: doc,
          })
        : req.continue());
    });
    await p.reload({ waitUntil: "networkidle0" });
    const rendered = await p.$$eval("footer [data-ecosystem] li > *", (els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        /* Same two-type-worlds note as the baseline test above: strict
           DOM sees string | null, the lint project sees string. */
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return { text: el.textContent?.trim() ?? "", weight: cs.fontWeight,
          opacity: cs.opacity, deco: cs.textDecorationLine };
      }));
    expect(rendered.map((r) => r.text)).toEqual(["Half-Built Robots", "The Bead Reserve", "half-built-ui"]);
    /* The link keeps the footer's underline-on-hover treatment rather
       than falling back to the browser's default underline. */
    expect(rendered[0].deco).toBe("none");
    /* Undeployed, so dimmed. */
    expect(Number(rendered[1].opacity)).toBeLessThan(1);
    /* You are here, so bold. */
    expect(rendered[2].weight).toBe("700");
  }, 30_000);

  it("the toc renders one link per section and every href target exists", async () => {
    const p = await open();
    const hrefs = await p.$$eval('.site-rail-toc a', (els) =>
      els.map((el) => el.getAttribute("href") ?? ""));
    expect(hrefs).toEqual(SECTIONS.map((s) => `#${s.id}`));
    const missing = await p.evaluate((ids: string[]) =>
      ids.filter((id) => document.getElementById(id) === null), SECTIONS.map((s) => s.id));
    expect(missing, `toc targets missing from the page: ${missing.join(", ")}`).toEqual([]);
  }, 30_000);
});
