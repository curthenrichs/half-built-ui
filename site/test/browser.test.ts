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
import { readFileSync } from "node:fs";
import type { Browser, HTTPRequest, Page } from "puppeteer-core";
import { AxePuppeteer } from "@axe-core/puppeteer";
import type { RunOptions } from "axe-core";
import {
  startPreview,
  stopPreview,
  launchChrome,
  desktopPage,
  phonePage,
} from "@half-built/tooling/test-kit/browser-server.ts";
import { SECTIONS } from "../src/data/sections";
import { SITE_NAME } from "../src/data/site";

const enabled = process.env.BROWSER_TESTS === "1";

const PORT = 4327;
const ORIGIN = `http://localhost:${PORT}`;

/* The token sheet's accent-1 chip (the Palette table in index.astro's
   CSS-primitives section): a real rendered element that the palette
   editor must actually repaint, not just the custom property it sets.
   The attribute selector matches the literal string the Palette
   component emits for a token entry, so it is exact. */
const ACCENT_1_CHIP = '.palette-chip[style="background-color:var(--accent-1)"]';

/* WCAG 2.2 A and AA, which is the blog's stated target. The 2.2 tags
   add target size (2.5.8); the other new 2.2 criteria are not
   automatable and were checked by hand when the move to 2.2 landed. Best-practice rules are left out so a failure
   here always maps to a success criterion. */
const RUN: RunOptions = {
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"],
  },
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
  const lines = violations.map(
    (v) =>
      `  ${v.id} [${v.impact ?? "?"}] ${v.help}\n    ${v.helpUrl}\n${v.targets.map((t) => `    - ${t}`).join("\n")}`,
  );

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

  type EcosystemMode = "fixture" | "abort";

  const ECOSYSTEM_FIXTURE = readFileSync(
    new URL("./fixtures/ecosystem.json", import.meta.url),
    "utf-8",
  );

  /* Aborted ecosystem requests on the current page, for the fallback
     test to wait out the island's retries by count, not by clock. */
  let ecosystemAborts = 0;
  let onEcosystemAbort: (() => void) | undefined;

  /* Resolves once the page has aborted n ecosystem requests; the timer
     only bounds a hang, it is not a wait for time to pass. */
  function ecosystemAborted(n: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        onEcosystemAbort = undefined;

        reject(
          new Error(
            `only ${String(ecosystemAborts)} of ${String(n)} ecosystem requests arrived`,
          ),
        );
      }, 10_000);

      const check = (): void => {
        if (ecosystemAborts < n) return;
        clearTimeout(timer);
        onEcosystemAbort = undefined;
        resolve();
      };

      onEcosystemAbort = check;
      check();
    });
  }

  /* One handler per page: two handlers on one request throw "already
     handled", so a test picks the mode through open() rather than
     adding its own. A test that needs to intercept something else on
     the same page (the cold-load palette test blocks /_astro/
     scripts) passes `extra`: it runs for every non-ecosystem request
     and returns true once it has itself aborted or responded, so this
     handler's own `req.continue()` is skipped rather than double-
     handling the request. */
  async function routeEcosystem(
    p: Page,
    mode: EcosystemMode,
    extra?: (req: HTTPRequest) => boolean,
  ): Promise<void> {
    ecosystemAborts = 0;
    await p.setRequestInterception(true);

    p.on("request", (req) => {
      if (!req.url().includes("ecosystem.json")) {
        if (extra?.(req)) return;
        void req.continue();
        return;
      }

      if (mode === "abort") {
        ecosystemAborts++;
        onEcosystemAbort?.();
        void req.abort();
        return;
      }

      void req.respond({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: ECOSYSTEM_FIXTURE,
      });
    });
  }

  /* networkidle0, not domcontentloaded: the toc, theme toggle, and
     palette editor all mount from a module script with no DOM marker
     to wait on. */
  async function open(
    options: { ecosystem?: EcosystemMode } = {},
  ): Promise<Page> {
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

    await routeEcosystem(p, options.ecosystem ?? "fixture");
    await p.goto(`${ORIGIN}/`, { waitUntil: "networkidle0" });

    /* Colors must be settled when axe reads them: a theme flip mid
       transition can interpolate a color past its passing endpoint. */
    await p.addStyleTag({
      content:
        "*, *::before, *::after { transition: none !important; animation: none !important; }",
    });

    return p;
  }

  /* A phone-width page with the popout demo's first trigger centered.
     Animations are off for the same settled-paint reason as open(): the
     sheet's entrance (popout-rise, popout.css) slides up from
     translateY(100%) over 150ms, and an unforced read lands
     mid-animation. */
  async function openPhone(
    options: { ecosystem?: EcosystemMode } = {},
  ): Promise<Page> {
    if (!browser) throw new Error("no browser (beforeAll failed)");
    const p = await phonePage(browser);
    page = p;

    /* Same isolation as open(): no test inherits another's persisted
       palette or theme. */
    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.clear();
      } catch {
        /* storage unavailable; nothing persisted to clear */
      }
    });

    await routeEcosystem(p, options.ecosystem ?? "fixture");
    await p.goto(`${ORIGIN}/`, { waitUntil: "networkidle0" });

    await p.addStyleTag({
      content:
        "*, *::before, *::after { transition: none !important; animation: none !important; }",
    });

    await p.$eval("#demo-popout-1", (t) => {
      t.scrollIntoView({ block: "center", behavior: "instant" });
    });

    return p;
  }

  async function settleFrames(p: Page): Promise<void> {
    await p.evaluate(
      () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }),
    );
  }

  async function popoutOpen(p: Page): Promise<boolean> {
    return p.$eval("dialog.popout", (s) => s.open);
  }

  async function activeId(p: Page): Promise<string> {
    return p.evaluate(() => document.activeElement?.id ?? "");
  }

  it("the Subscribe demo shows its overridden invalid line", async () => {
    const p = await open();
    await p.type("#components .subscribe-email", "not-an-email");
    await p.click("#components .subscribe-submit");

    const text = await p.$eval(
      "#components .subscribe-status",
      (el) => el.textContent,
    );

    expect(text).toBe("Sample override. That address will not do.");
  });

  it("the Meter demos expose clamped values and paint the fill to that share", async () => {
    const p = await open();

    const meters = await p.$$eval("#components [role='meter']", (els) =>
      els.map((el) => ({
        label: el.getAttribute("aria-label"),
        now: el.getAttribute("aria-valuenow"),
        max: el.getAttribute("aria-valuemax"),
        text: el.getAttribute("aria-valuetext"),
        inner: el.clientWidth,
        fill:
          el.querySelector(".meter-fill")?.getBoundingClientRect().width ?? -1,
      })),
    );

    const byLabel = (name: string) => {
      const found = meters.find((m) => m.label === name);

      if (!found) {
        throw new Error(`no meter labelled ${name}`);
      }

      return found;
    };

    const three = byLabel("Sample progress");
    const over = byLabel("Sample overshoot");
    const empty = byLabel("Sample empty total");
    const missing = byLabel("Sample missing value");

    expect(three).toMatchObject({
      label: "Sample progress",
      now: "3",
      max: "10",
      text: "3 of 10",
    });

    expect(three.fill / three.inner).toBeGreaterThan(0.29);
    expect(three.fill / three.inner).toBeLessThan(0.31);
    expect(over).toMatchObject({ now: "10", text: "Over the top" });
    expect(over.fill).toBeCloseTo(over.inner, 0);
    expect(empty).toMatchObject({ now: "0", max: "0" });
    expect(empty.fill).toBe(0);
    expect(missing).toMatchObject({ now: "0", max: "10", text: "0 of 10" });
    expect(missing.fill).toBe(0);
  });

  it("keeps the Meter fill visible in forced colors", async () => {
    const p = await open();

    /* Puppeteer's emulateMediaFeatures rejects forced-colors, so the
       feature goes through the protocol directly. */
    const session = await p.createCDPSession();

    await session.send("Emulation.setEmulatedMedia", {
      features: [{ name: "forced-colors", value: "active" }],
    });

    const fill = await p.$eval(
      "#components [role='meter'][aria-label='Sample progress'] .meter-fill",
      (el) => ({
        adjust: getComputedStyle(el).forcedColorAdjust,
        width: el.getBoundingClientRect().width,
      }),
    );

    expect(fill.adjust).toBe("none");
    expect(fill.width).toBeGreaterThan(0);
  });

  it("has no WCAG 2.2 AA violations in the light theme", async () => {
    const p = await open();

    /* Light is forced, not assumed: the head stamp follows
       prefers-color-scheme when nothing is stored, so on a
       dark-preference machine the page would otherwise arrive dark
       and an unforced "light" pass would audit dark twice. */
    await p.evaluate(() => {
      delete document.documentElement.dataset.theme;
    });

    const violations = await runAxe(p);
    expect(violations, report("light", violations)).toEqual([]);
  }, 60_000);

  it("has no WCAG 2.2 AA violations in the dark theme", async () => {
    const p = await open();

    await p.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });

    /* One rAF tick so the dark token layer's cascade has actually
       applied before axe reads computed colors. */
    await p.evaluate(async () => {
      await new Promise((resolve) => {
        requestAnimationFrame(resolve);
      });
    });

    const violations = await runAxe(p);
    expect(violations, report("dark", violations)).toEqual([]);
  }, 60_000);

  /* The category row's targets (24px for 2.5.8, plus 2px headroom) must not cost the ring or
     the one-line ellipsis: each link's border box stays inside the
     row's clip box, so the inset focus ring keeps all four sides, and
     the row stays a single line however many categories a card has. */
  it("card category links reach 26px inside the row's clip box, on one line", async () => {
    const p = await open();

    const m = await p.$$eval(".entry-cat .post-categories", (rows) =>
      rows.map((row) => {
        const r = row.getBoundingClientRect();
        const style = getComputedStyle(row);

        return {
          nowrap: style.whiteSpace === "nowrap",
          links: [...row.querySelectorAll("a")].map((a) => {
            const l = a.getBoundingClientRect();

            return {
              height: l.height,
              top: l.top,
              bottom: l.bottom,
              clipTop: r.top,
              clipBottom: r.bottom,
            };
          }),
        };
      }),
    );

    expect(m.length).toBeGreaterThan(0);

    for (const row of m) {
      expect(row.nowrap).toBe(true);

      for (const l of row.links) {
        /* 24px is the 2.5.8 floor; the card keeps 2px over it so a
           rounding change fails here before it fails the criterion. */
        expect(l.height).toBeGreaterThanOrEqual(26);
        expect(l.top).toBeGreaterThanOrEqual(l.clipTop);
        expect(l.bottom).toBeLessThanOrEqual(l.clipBottom);
      }
    }
  }, 30_000);

  /* No demo card has more categories than fit, so this one is given
     some: the row must overflow and ellipsize on its single line, never
     wrap to a second, and the added links keep their 26px boxes inside
     the clip like the rest. */
  it("a card with more categories than fit ellipsizes on one line", async () => {
    const p = await open();

    const m = await p.$eval(".entry-cat .post-categories", (row) => {
      const before = row.getBoundingClientRect().height;
      const first = row.querySelector("a");
      if (!first) throw new Error("no category link in the first card");

      for (let i = 0; i < 12; i++) {
        row.append(", ", first.cloneNode(true));
      }

      const r = row.getBoundingClientRect();
      const last = row.querySelector("a:last-of-type")?.getBoundingClientRect();

      return {
        before,
        after: r.height,
        overflows: row.scrollWidth > row.clientWidth,
        ellipsis: getComputedStyle(row).textOverflow === "ellipsis",
        lastTop: last?.top ?? 0,
        lastBottom: last?.bottom ?? 0,
        clipTop: r.top,
        clipBottom: r.bottom,
      };
    });

    expect(m.overflows).toBe(true);
    expect(m.ellipsis).toBe(true);
    expect(m.after).toBe(m.before);
    expect(m.lastTop).toBeGreaterThanOrEqual(m.clipTop);
    expect(m.lastBottom).toBeLessThanOrEqual(m.clipBottom);
  }, 30_000);

  it("dispatching an input on base 1 repaints --brand-1-500 and a rendered accent element", async () => {
    const p = await open();
    await p.click("[data-palette-editor] summary");
    await p.waitForSelector(ACCENT_1_CHIP);

    const before = await p.$eval(
      ACCENT_1_CHIP,
      (el) => getComputedStyle(el).backgroundColor,
    );

    await p.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>(
        'input[data-palette-base="1"]',
      );

      if (!input) throw new Error("no base-1 input");
      input.value = "#2f9e44";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    /* the editor applies a pick on the next animation frame */
    await p.waitForFunction(
      () =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--brand-1-500")
          .trim() === "#2f9e44",
    );

    const after = await p.$eval(
      ACCENT_1_CHIP,
      (el) => getComputedStyle(el).backgroundColor,
    );

    expect(after, "the accent-1 chip's painted color never changed").not.toBe(
      before,
    );

    /* the token sheet's hex readout follows the pick (token-hexes.ts
       refreshes on the html style mutation, an async observer tick) */
    await p.waitForFunction(
      () =>
        document.querySelector('[data-token-hex="--accent-1"]')?.textContent ===
        "#2f9e44",
    );
  }, 30_000);

  it("the copyable css block declares exactly the twelve override properties", async () => {
    const p = await open();

    /* Same two-type-worlds note as palette-editor.ts's copy handler:
       strict DOM sees string | null, the lint project sees string. */

    const text = await p.$eval(
      "[data-palette-css]",
      (el) => el.textContent || "",
    );

    expect(text).toMatch(/^:root \{$/m);
    const names = [...text.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]);

    expect(new Set(names)).toEqual(
      new Set([
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
      ]),
    );

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

    const before = await p.$eval(
      KEYWORD_SPAN,
      (el) => getComputedStyle(el).color,
    );

    const beforeBg = await p.$eval(
      PRE,
      (el) => getComputedStyle(el).backgroundColor,
    );

    await p.click("[data-palette-editor] summary");
    await p.click('[data-palette-preset][data-base-1="#2f9e44"]');

    const after = await p.$eval(
      KEYWORD_SPAN,
      (el) => getComputedStyle(el).color,
    );

    expect(after, "the keyword span's painted color never changed").not.toBe(
      before,
    );

    const afterBg = await p.$eval(
      PRE,
      (el) => getComputedStyle(el).backgroundColor,
    );

    expect(afterBg, "the code ground's painted color never changed").not.toBe(
      beforeBg,
    );
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

  it("a PostLink to a draft degrades to text and a fallback stands in", async () => {
    const p = await open();
    const html = await p.content();

    /* The draft is never linked, and its tip never ships. */
    expect(html).not.toMatch(/href="[^"]*sample-draft/);
    expect(html).not.toContain('data-tooltip="Sample draft"');

    /* The name stays in the sentence as plain text. */
    const pending = await p.$eval(".sample-pending-link", (el) => ({
      text: el.textContent || "",
      links: el.querySelectorAll("a").length,
    }));

    expect(pending.text).toContain("the sample draft");
    expect(pending.links).toBe(0);

    /* A hidden passage shows its fallback; a visible one never does. */
    expect(html).toContain(
      "This fallback stands in while the draft is unpublished.",
    );

    expect(html).not.toContain("This passage waits for the draft.");
    expect(html).not.toContain("This passage never renders");
    expect(html).not.toContain("This fallback never renders");
  }, 30_000);

  it("a popout opens below its trigger, outside the table scroller, and follows it", async () => {
    const p = await open();
    /* Row two, not row one: an anchored popout covering the next row's
       own trigger is accepted desktop popover behavior (you press
       outside or Esc, then open the next), so opening row one first
       would leave row two unreachable by a real click. Row two has
       nothing below it in this three-row demo to cover. */
    await p.click("#demo-popout-2");

    const first = await p.evaluate(() => {
      const s = document.querySelector("dialog.popout");
      const t = document.getElementById("demo-popout-2");
      if (!(s instanceof HTMLDialogElement) || !t) throw new Error("missing");
      const sr = s.getBoundingClientRect();
      const tr = t.getBoundingClientRect();

      return {
        open: s.open,
        anchored: s.classList.contains("is-anchored"),
        parentIsBody: s.parentElement === document.body,
        gap: sr.top - tr.bottom,
        width: sr.width,
        label: s.querySelector(".popout-label")?.textContent ?? "",
      };
    });

    expect(first.open).toBe(true);
    expect(first.anchored).toBe(true);
    expect(first.parentIsBody).toBe(true);
    expect(first.gap).toBeGreaterThan(0);
    expect(first.width).toBeGreaterThan(40);
    expect(first.label).toBe("Row two");

    /* Scroll the page; after a frame the box keeps the same gap.
       behavior: "instant" overrides the site's global smooth scroll
       (packages/css/src/base/reset.css), which otherwise spreads a
       scrollBy over several frames and leaves the trigger and the
       still-catching-up surface briefly a few px apart: a real effect
       of a site-wide reset the brief's plain scrollBy(0, 40) did not
       anticipate, not a placement defect (verified: the same click and
       read comes back diff 0 with an instant scroll, and a repeatable
       diff 4 with the default smooth one). */
    const gapAfter = await p.evaluate(async () => {
      window.scrollBy({ top: 40, behavior: "instant" });

      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });

      const s = document.querySelector("dialog.popout");
      const t = document.getElementById("demo-popout-2");
      if (!s || !t) throw new Error("missing");
      return s.getBoundingClientRect().top - t.getBoundingClientRect().bottom;
    });

    expect(Math.abs(gapAfter - first.gap)).toBeLessThanOrEqual(1);

    /* The trigger in the row above swaps content and stays open past
       the queued close event of the first, even though it sits under
       where row two's popout was open a moment ago. */
    await p.click("#demo-popout-1");

    await p.waitForFunction(
      (label) => {
        const s = document.querySelector("dialog.popout");
        return (
          s instanceof HTMLDialogElement &&
          s.open &&
          s.querySelector(".popout-label")?.textContent === label
        );
      },
      {},
      "Row one",
    );

    const second = await p.$eval("dialog.popout", (s) => ({
      open: s.open,
      label: s.querySelector(".popout-label")?.textContent ?? "",
      hasLink: s.querySelector(".popout-body a") !== null,
    }));

    expect(second).toEqual({ open: true, label: "Row one", hasLink: true });
  });

  it("the header renders no search block when searchAction is false", async () => {
    const p = await open();

    const found = await p.$eval(".site-header", (h) => ({
      block: h.querySelector(".navigation-search") !== null,
      form: h.querySelector('form[role="search"]') !== null,
    }));

    expect(found).toEqual({ block: false, form: false });
  });

  it("the header home link shows the site name when the title slot is empty", async () => {
    const p = await open();

    const text = await p.$eval(".site-header .site-title a", (a) =>
      a.textContent.trim(),
    );

    expect(text).toBe(SITE_NAME);
  });

  it("the Frame section ships a worked title slot example", async () => {
    const p = await open();

    const text = await p.$eval(
      ".demo-title-slot-sample",
      (el) => el.textContent || "",
    );

    expect(text).toContain('slot="title"');
    expect(text).toContain("<Masthead");
  });

  it("the Popout subsection ships a worked example matching the demo", async () => {
    const p = await open();

    const text = await p.$eval(
      ".demo-popout-sample",
      (el) => el.textContent || "",
    );

    expect(text).toContain("<Popout");
    expect(text).toContain("mountPopouts");
    expect(text).toContain("components/Popout.astro");
  });

  it("a popout inside a horizontally scrolled table follows the scroller, unclipped", async () => {
    const p = await open();

    /* The demo table is not wide enough to overflow .table-scroll on
       its own; widen it only for this test (never the shipped demo
       markup or CSS) so the scroller actually has somewhere to scroll
       to. */
    await p.evaluate(() => {
      const table = document.getElementById("demo-popout-1")?.closest("table");
      if (!(table instanceof HTMLElement)) throw new Error("missing table");
      table.style.minWidth = "2000px";
    });

    await p.click("#demo-popout-1");

    const before = await p.evaluate(() => {
      const s = document.querySelector("dialog.popout");
      const t = document.getElementById("demo-popout-1");
      const scroller = t?.closest(".table-scroll");

      if (!(s instanceof HTMLDialogElement) || !t || !scroller) {
        throw new Error("missing");
      }

      return {
        open: s.open,
        parentIsBody: s.parentElement === document.body,
        left: s.getBoundingClientRect().left,
        width: s.getBoundingClientRect().width,
        triggerLeft: t.getBoundingClientRect().left,
        scrollLeftBefore: (scroller as HTMLElement).scrollLeft,
      };
    });

    expect(before.open).toBe(true);
    /* Not a descendant of the scroller, so nothing about it clips: the
       surface sits on <body>, and its full width renders regardless of
       the scroller's own overflow-x box. */
    expect(before.parentIsBody).toBe(true);
    expect(before.width).toBeGreaterThan(40);

    /* Scroll the inner .table-scroll box, not the window: a capturing
       document listener sees this even though the scroll event does
       not bubble from the inner scroller. */
    const after = await p.evaluate(async () => {
      const t = document.getElementById("demo-popout-1");
      const scroller = t?.closest(".table-scroll");
      if (!t || !(scroller instanceof HTMLElement)) throw new Error("missing");
      scroller.scrollBy({ left: 150, behavior: "instant" });

      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });

      const s = document.querySelector("dialog.popout");
      if (!(s instanceof HTMLDialogElement)) throw new Error("missing");

      return {
        open: s.open,
        left: s.getBoundingClientRect().left,
        width: s.getBoundingClientRect().width,
        triggerLeft: t.getBoundingClientRect().left,
        scrollLeftAfter: scroller.scrollLeft,
      };
    });

    expect(after.open).toBe(true);
    expect(after.scrollLeftAfter).toBeGreaterThan(before.scrollLeftBefore);
    /* Still full width after the scroller moved: the box was never cut
       down to whatever sliver of it the scroller's own box still
       overlaps. */
    expect(after.width).toBeGreaterThan(40);

    const triggerDelta = before.triggerLeft - after.triggerLeft;
    const surfaceDelta = before.left - after.left;
    expect(triggerDelta).toBeGreaterThan(0);
    expect(Math.abs(surfaceDelta - triggerDelta)).toBeLessThanOrEqual(1);
  });

  it("at phone width a popout is a modal sheet and the backdrop closes it", async () => {
    const p = await openPhone();
    await p.click("#demo-popout-1");

    const state = await p.evaluate(() => {
      const s = document.querySelector("dialog.popout");
      if (!(s instanceof HTMLDialogElement)) throw new Error("missing");
      const r = s.getBoundingClientRect();

      return {
        modal: s.matches(":modal"),
        sheet: s.classList.contains("is-sheet"),
        locked: document.documentElement.classList.contains("popout-open"),
        bottomGap: Math.round(window.innerHeight - r.bottom),
        fullWidth: Math.round(r.width) === document.documentElement.clientWidth,
      };
    });

    expect(state).toEqual({
      modal: true,
      sheet: true,
      locked: true,
      bottomGap: 0,
      fullWidth: true,
    });

    /* A tap near the top of the viewport lands on the backdrop. */
    await p.mouse.click(20, 20);

    await p.waitForFunction(
      () => !document.querySelector<HTMLDialogElement>("dialog.popout")?.open,
    );

    const after = await p.evaluate(() => {
      const s = document.querySelector("dialog.popout");
      if (!(s instanceof HTMLDialogElement)) throw new Error("missing");

      return {
        open: s.open,
        locked: document.documentElement.classList.contains("popout-open"),
      };
    });

    expect(after).toEqual({ open: false, locked: false });
  });

  it("near the viewport bottom a popout flips above its trigger", async () => {
    const p = await open();

    await p.evaluate(() => {
      const t = document.getElementById("demo-popout-2");
      if (!t) throw new Error("missing");
      const r = t.getBoundingClientRect();

      window.scrollBy({
        top: r.bottom - (window.innerHeight - 24),
        behavior: "instant",
      });
    });

    await p.click("#demo-popout-2");

    const r = await p.evaluate(() => {
      const s = document.querySelector("dialog.popout");
      const t = document.getElementById("demo-popout-2");
      if (!(s instanceof HTMLDialogElement) || !t) throw new Error("missing");

      return {
        open: s.open,
        boxBottom: s.getBoundingClientRect().bottom,
        triggerTop: t.getBoundingClientRect().top,
        triggerBottom: t.getBoundingClientRect().bottom,
        vh: window.innerHeight,
      };
    });

    expect(r.open).toBe(true);
    /* The setup held: no room for the box below the trigger. */
    expect(r.triggerBottom).toBeGreaterThan(r.vh - 60);
    expect(r.boxBottom).toBeLessThanOrEqual(r.triggerTop);
  });

  it("near the right edge a popout clamps inside the viewport", async () => {
    const p = await open();

    /* Pinned to the right edge in-test only (never the shipped demo
       markup or CSS): the demo table sits at the left of the column. */
    await p.$eval("#demo-popout-2", (t) => {
      t.scrollIntoView({ block: "center", behavior: "instant" });
      const top = t.getBoundingClientRect().top;
      const b = t as HTMLElement;
      b.style.position = "fixed";
      b.style.right = "4px";
      b.style.top = `${String(top)}px`;
    });

    await p.click("#demo-popout-2");

    const r = await p.evaluate(() => {
      const s = document.querySelector("dialog.popout");
      const t = document.getElementById("demo-popout-2");
      if (!(s instanceof HTMLDialogElement) || !t) throw new Error("missing");
      const sr = s.getBoundingClientRect();

      return {
        open: s.open,
        left: sr.left,
        right: sr.right,
        triggerLeft: t.getBoundingClientRect().left,
        vw: window.innerWidth,
      };
    });

    expect(r.open).toBe(true);
    /* Left-aligned to the trigger it would have run off screen. */
    expect(r.left).toBeLessThan(r.triggerLeft);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(r.right).toBeLessThanOrEqual(r.vw - 30);
  });

  it("an anchored open, by click or by Enter, leaves the page scroll alone", async () => {
    const p = await open();

    await p.$eval("#demo-popout-1", (t) => {
      t.scrollIntoView({ block: "center", behavior: "instant" });
    });

    const before = await p.evaluate(() => window.scrollY);
    await p.click("#demo-popout-1");
    await settleFrames(p);
    expect(await popoutOpen(p)).toBe(true);
    expect(await p.evaluate(() => window.scrollY)).toBe(before);

    await p.keyboard.press("Escape");
    expect(await popoutOpen(p)).toBe(false);
    await p.keyboard.press("Enter");
    await settleFrames(p);
    expect(await popoutOpen(p)).toBe(true);
    expect(await p.evaluate(() => window.scrollY)).toBe(before);
  });

  it("the keyboard opens the popout, reaches its link, and leaves it", async () => {
    const p = await open();

    await p.$eval("#demo-popout-1", (t) => {
      t.scrollIntoView({ block: "center", behavior: "instant" });
      (t as HTMLElement).focus();
    });

    await p.keyboard.press("Enter");
    expect(await popoutOpen(p)).toBe(true);

    let reached = false;

    for (let i = 0; i < 4 && !reached; i++) {
      await p.keyboard.press("Tab");

      reached = await p.evaluate(
        () =>
          document.activeElement?.matches("dialog.popout .popout-body a") ??
          false,
      );
    }

    expect(reached).toBe(true);

    await p.keyboard.press("Escape");
    expect(await popoutOpen(p)).toBe(false);
    expect(await activeId(p)).toBe("demo-popout-1");

    /* Shift+Tab off the box's first stop hands focus back to the
       trigger; Tab off its last stop moves on past the trigger. */
    await p.keyboard.press("Enter");
    expect(await popoutOpen(p)).toBe(true);
    await p.keyboard.down("Shift");
    await p.keyboard.press("Tab");
    await p.keyboard.up("Shift");
    await settleFrames(p);
    expect(await popoutOpen(p)).toBe(false);
    expect(await activeId(p)).toBe("demo-popout-1");

    await p.keyboard.press("Enter");
    expect(await popoutOpen(p)).toBe(true);

    for (let i = 0; i < 6 && (await popoutOpen(p)); i++) {
      await p.keyboard.press("Tab");
      await settleFrames(p);
    }

    expect(await popoutOpen(p)).toBe(false);

    const landed = await p.evaluate(() => {
      const t = document.getElementById("demo-popout-1");
      const a = document.activeElement;
      return Boolean(
        t &&
        a &&
        a !== document.body &&
        t.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING &&
        !a.closest("footer"),
      );
    });

    expect(landed).toBe(true);
  });

  it("the sheet locks page scroll and hands it back where it was", async () => {
    const p = await openPhone();
    const before = await p.evaluate(() => window.scrollY);
    await p.click("#demo-popout-1");
    expect(await popoutOpen(p)).toBe(true);
    expect(await p.evaluate(() => window.scrollY)).toBe(before);

    /* A wheel over the backdrop would chain to the page if the lock
       did not hold. */
    await p.mouse.move(20, 20);
    await p.mouse.wheel({ deltaY: 400 });
    await settleFrames(p);
    expect(await popoutOpen(p)).toBe(true);
    expect(await p.evaluate(() => window.scrollY)).toBe(before);

    await p.keyboard.press("Escape");
    await settleFrames(p);
    expect(await popoutOpen(p)).toBe(false);
    expect(await p.evaluate(() => window.scrollY)).toBe(before);

    /* The same wheel scrolls the page once the sheet is gone, so the
       held scroll above was the lock and not a dead gesture. */
    await p.mouse.wheel({ deltaY: 400 });
    await p.waitForFunction((y) => window.scrollY > y, {}, before);
    expect(await p.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  });

  it("has no WCAG 2.2 AA violations with the sheet open at phone width", async () => {
    const p = await openPhone();
    await p.click("#demo-popout-1");
    expect(await popoutOpen(p)).toBe(true);
    const violations = await runAxe(p);

    expect(violations, report("phone, sheet open", violations)).toEqual([]);
  }, 60_000);

  /* Phones start the footer's Feeds and Ecosystem groups closed, so the
     page-wide passes above never audit those lists (the sheet pass sees
     only the open Site group). Open every group, audit both themes, and
     pin the desktop list styling so the phone-only fix cannot leak
     upward. */
  it("has no WCAG 2.2 AA violations in the open phone footer, in both themes", async () => {
    if (!browser) throw new Error("no browser (beforeAll failed)");
    const p = await phonePage(browser);
    page = p;

    await p.evaluateOnNewDocument(() => {
      try {
        localStorage.clear();
      } catch {
        /* storage unavailable; nothing persisted to clear */
      }
    });

    await routeEcosystem(p, "fixture");
    await p.goto(`${ORIGIN}/`, { waitUntil: "networkidle0" });

    await p.addStyleTag({
      content:
        "*, *::before, *::after { transition: none !important; animation: none !important; }",
    });

    await p.evaluate(() => {
      for (const d of document.querySelectorAll<HTMLDetailsElement>(
        "details.footer-sitemap-collapsible",
      )) {
        d.open = true;
      }

      document
        .querySelector(".footer-sitemap")
        ?.scrollIntoView({ block: "center", behavior: "instant" });
    });

    for (const theme of ["light", "dark"] as const) {
      await p.evaluate(async (t) => {
        if (t === "dark") document.documentElement.dataset.theme = "dark";
        else delete document.documentElement.dataset.theme;

        await new Promise((resolve) => {
          requestAnimationFrame(resolve);
        });
      }, theme);

      const violations = await runAxe(p);

      expect(
        violations,
        report(`phone, footer open, ${theme}`, violations),
      ).toEqual([]);
    }

    /* Every row keeps one rhythm, links or not: the Ecosystem list
       mixes links with plain-text items (the current site, pending
       entries), and a 24px line on the links alone left those rows
       shorter. */
    const rows = await p.$$eval(".footer-sitemap-group li", (lis) =>
      lis.map((li) => li.getBoundingClientRect().height),
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((h) => Math.round(h)))).toEqual(new Set([24]));

    const desk = await desktopPage(browser);

    try {
      await routeEcosystem(desk, "fixture");
      await desk.goto(`${ORIGIN}/`, { waitUntil: "networkidle0" });

      const desktop = await desk.$eval(".footer-sitemap-group li", (li) => {
        const a = li.querySelector("a");

        return {
          margin: getComputedStyle(li).marginTop,
          lineHeight: getComputedStyle(li).lineHeight,
          display: a ? getComputedStyle(a).display : "",
        };
      });

      expect(desktop.margin).toBe("4px");
      expect(desktop.lineHeight).not.toBe("24px");
      expect(desktop.display).toBe("inline");
    } finally {
      await desk.close();
    }
  }, 90_000);

  it("has no WCAG 2.2 AA violations with a popout open, in both themes", async () => {
    for (const theme of ["light", "dark"] as const) {
      const p = await open();

      await p.evaluate(async (t) => {
        if (t === "dark") document.documentElement.dataset.theme = "dark";
        else delete document.documentElement.dataset.theme;

        await new Promise((resolve) => {
          requestAnimationFrame(resolve);
        });
      }, theme);

      await p.click("#demo-popout-1");
      const violations = await runAxe(p);

      expect(violations, report(`${theme}, popout open`, violations)).toEqual(
        [],
      );

      await p.close();
      page = undefined;
    }
  }, 120_000);

  it("the PostLink demo's resolved link lands on a real page", async () => {
    const p = await open();

    const href = await p.$eval(
      "#components a[href$='/sample-published/']",
      (a) => a.getAttribute("href"),
    );

    const res = await p.goto(`${ORIGIN}${href}`, {
      waitUntil: "networkidle0",
    });

    expect(res?.status()).toBe(200);
    expect(await p.$eval("h1", (h) => h.textContent)).toMatch(/sample post/i);

    for (const theme of ["light", "dark"] as const) {
      await p.evaluate((t) => {
        if (t === "dark") document.documentElement.dataset.theme = "dark";
        else delete document.documentElement.dataset.theme;
      }, theme);

      await settleFrames(p);
      const violations = await runAxe(p);

      expect(violations, report(`${theme}, sample post`, violations)).toEqual(
        [],
      );
    }
  }, 60_000);

  /* The policy pages (2026-09-29, Terms 2026-10-03): reached from the footer, clean in
     both themes, one main and one h1 each, and listed in the sitemap
     since they are real pages, unlike the sample post. */
  it("the footer's policy links land on real, axe-clean pages", async () => {
    const p = await open();

    /* The policies get their own Rules column, the license included,
       beside Site, More, and Ecosystem (owner call 2026-10-03). */
    const rules = await p.$$eval(".footer-sitemap-group", (groups) => {
      const g = groups.find(
        (el) => el.querySelector("h2")?.textContent.trim() === "Rules",
      );

      return g
        ? [...g.querySelectorAll("a")].map((a) => [
            a.textContent.trim(),
            a.getAttribute("href"),
          ])
        : [];
    });

    expect(rules).toEqual([
      ["Privacy", "/privacy/"],
      ["Terms", "/terms/"],
      ["Accessibility", "/accessibility/"],
      [
        "MIT License",
        "https://github.com/curthenrichs/half-built-ui/blob/main/LICENSE",
      ],
    ]);

    const hrefs = await p.$$eval("footer a", (links) =>
      links
        .map((a) => a.getAttribute("href"))
        .filter(
          (h) =>
            h === "/privacy/" || h === "/terms/" || h === "/accessibility/",
        ),
    );

    expect(hrefs.sort()).toEqual(["/accessibility/", "/privacy/", "/terms/"]);

    const sitemap = await (await fetch(`${ORIGIN}/sitemap-0.xml`)).text();

    for (const href of hrefs) {
      const res = await p.goto(`${ORIGIN}${href}`, {
        waitUntil: "networkidle0",
      });

      expect(res?.status()).toBe(200);
      expect(await p.$$eval("main", (els) => els.length)).toBe(1);
      expect(await p.$$eval("h1", (els) => els.length)).toBe(1);
      expect(sitemap).toContain(`${href}</loc>`);

      for (const theme of ["light", "dark"] as const) {
        await p.evaluate((t) => {
          if (t === "dark") document.documentElement.dataset.theme = "dark";
          else delete document.documentElement.dataset.theme;
        }, theme);

        await settleFrames(p);
        const violations = await runAxe(p);

        expect(violations, report(`${theme}, ${href}`, violations)).toEqual([]);
      }
    }
  }, 60_000);

  /* No 404.html once meant Pages answered every unknown URL with the
     homepage and a 200 (a soft 404). The custom page must come back
     with a real 404, render the site chrome, be axe-clean, and stay out
     of the sitemap (2026-10-03). */
  it("an unknown URL gets a real 404 page", async () => {
    const p = await open();

    const res = await p.goto(`${ORIGIN}/not-a-real-page/`, {
      waitUntil: "networkidle0",
    });

    expect(res?.status()).toBe(404);
    expect(await p.$$eval("main", (els) => els.length)).toBe(1);
    expect(await p.$$eval("h1", (els) => els.length)).toBe(1);
    expect(await p.$$eval('main a[href="/"]', (els) => els.length)).toBe(1);

    for (const theme of ["light", "dark"] as const) {
      await p.evaluate((t) => {
        if (t === "dark") document.documentElement.dataset.theme = "dark";
        else delete document.documentElement.dataset.theme;
      }, theme);

      await settleFrames(p);
      const violations = await runAxe(p);
      expect(violations, report(`${theme}, 404`, violations)).toEqual([]);
    }

    const sitemap = await (await fetch(`${ORIGIN}/sitemap-0.xml`)).text();
    expect(sitemap).not.toContain("404");
  }, 60_000);

  it("robots.txt welcomes crawlers and AI training", async () => {
    const robots = await (await fetch(`${ORIGIN}/robots.txt`)).text();

    expect(robots).toContain(
      "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
    );

    expect(robots).toContain(
      "Sitemap: https://ui.half-built-robots.com/sitemap-index.xml",
    );
  });

  it("the type scale specimen shows every size stop", async () => {
    const p = await open();

    const names = await p.$$eval(".type-scale [data-size]", (els) =>
      els.map((e) => e.getAttribute("data-size")),
    );

    expect(names).toEqual(["xs", "sm", "base", "md", "lg", "xl", "xxl"]);

    const sizes = await p.$$eval(".type-scale [data-size]", (els) =>
      els.map((e) => parseFloat(getComputedStyle(e).fontSize)),
    );

    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
    }
  });

  it("the blog image demo wears the AI Art badge", async () => {
    const p = await open();
    expect(await p.$("#components .blog-image .badge-genai")).not.toBeNull();
  });

  /* The page's own main landmark, not the TwoColumn demo's: the demo
     passes mainTag="div", so "skip to main" and landmark navigation
     land on the page content rather than on placeholder paragraphs. */
  it("each page has exactly one main, and the TwoColumn demo holds none", async () => {
    const p = await open();

    expect(await p.$$eval("main", (els) => els.length)).toBe(1);
    expect(await p.$$eval("h1", (els) => els.length)).toBe(1);
    expect(await p.$("#frame .two-column main")).toBeNull();
    expect(await p.$("main article.static-page")).not.toBeNull();

    await p.goto(`${ORIGIN}/2026/09/01/sample-published/`, {
      waitUntil: "networkidle0",
    });

    expect(await p.$$eval("main", (els) => els.length)).toBe(1);
    expect(await p.$$eval("h1", (els) => els.length)).toBe(1);
    expect(await p.$("main article.static-page")).not.toBeNull();
  });

  it("a card's corner badges never overlap its reading-time chip", async () => {
    const p = await open();

    /* 900px is where the three-up card grid is narrowest: the reading
       time plus AI Art plus Demo no longer fit on one line. */
    for (const width of [900, 1280, 390]) {
      await p.setViewport({ width, height: 900 });

      const overlaps = await p.$$eval(
        "#cards .demo-card-grid article",
        (cards) =>
          cards.map((card) => {
            const time = card.querySelector(".reading-time");
            const chips = [...card.querySelectorAll(".corner-badges .chip")];
            if (!time) return false;
            const t = time.getBoundingClientRect();

            return chips.some((chip) => {
              const c = chip.getBoundingClientRect();
              return (
                c.left < t.right &&
                t.left < c.right &&
                c.top < t.bottom &&
                t.top < c.bottom
              );
            });
          }),
      );

      expect(overlaps, `width ${String(width)}`).not.toContain(true);
    }
  });

  it("every post card leads to the sample post, which stays out of search", async () => {
    const p = await open();

    const hrefs = await p.$$eval("#cards .entry-title a", (links) =>
      links.map((a) => a.getAttribute("href")),
    );

    expect(hrefs.length).toBeGreaterThan(0);

    for (const href of hrefs) {
      expect(href).toBe("/2026/09/01/sample-published/");
    }

    await p.goto(`${ORIGIN}/2026/09/01/sample-published/`, {
      waitUntil: "networkidle0",
    });

    expect(
      await p.$eval('meta[name="robots"]', (m) => m.getAttribute("content")),
    ).toBe("noindex");

    const sitemap = await (await fetch(`${ORIGIN}/sitemap-0.xml`)).text();
    expect(sitemap).toContain("<loc>");
    expect(sitemap).not.toContain("sample-published");
  });

  it("the TwoColumn demo renders its main column beside a sidebar", async () => {
    const p = await open();
    const demo = await p.$("#frame .two-column");
    expect(demo).not.toBeNull();
    expect(await p.$("#frame .two-column .sidebar .widget")).not.toBeNull();

    const [mainBox, sideBox] = await p.$$eval(
      "#frame .two-column > .site-main, #frame .two-column > .sidebar",
      (els) => els.map((e) => e.getBoundingClientRect().left),
    );

    expect(sideBox).toBeGreaterThan(mainBox);
  });

  it("the ExcerptStart card's text starts after the marker", async () => {
    const p = await open();

    const texts = await p.$$eval("#cards .demo-card-grid .post-item", (cards) =>
      cards.map((c) => c.textContent),
    );

    expect(texts.some((t) => t.includes("The card text starts here"))).toBe(
      true,
    );

    expect(texts.some((t) => t.includes("A short aside that opens"))).toBe(
      false,
    );
  });

  it("the path player opens with a glyph in its play button and paints both tracks", async () => {
    for (const theme of ["light", "dark"] as const) {
      const p = await open();

      await p.emulateMediaFeatures([
        { name: "prefers-reduced-motion", value: "reduce" },
      ]);

      await p.evaluate((t) => {
        if (t === "dark") document.documentElement.dataset.theme = "dark";
        else delete document.documentElement.dataset.theme;
      }, theme);

      await p.click(".demo-path-player");
      await settleFrames(p);
      expect(await p.$(".pp-plate .pp-play svg")).not.toBeNull();

      expect(
        await p.$eval(".pp-tracks", (c) => (c as HTMLCanvasElement).width),
      ).toBeGreaterThan(0);

      const violations = await runAxe(p);

      expect(
        violations,
        report(`${theme}, path player open`, violations),
      ).toEqual([]);

      await p.close();
      page = undefined;
    }
  }, 120_000);

  /* The frame's geometry, read the same way for the inline pattern and
     the open plate modal: the zone padding as the plate's inset in its
     frame, and the corner box's offsets from the plate's top-right. */
  interface FrameGeometry {
    inset: { top: number; right: number; bottom: number; left: number };
    box: { top: number; right: number; width: number; height: number };
  }

  async function frameGeometry(
    p: Page,
    frameSel: string,
    plateSel: string,
    boxSel: string,
  ): Promise<FrameGeometry> {
    return p.evaluate(
      (f, pl, b) => {
        const frame = document.querySelector(f);
        const plate = document.querySelector(pl);
        const box = document.querySelector(b);

        if (!frame || !plate || !box) {
          throw new Error(`missing ${f} / ${pl} / ${b}`);
        }

        const fr = frame.getBoundingClientRect();
        const pr = plate.getBoundingClientRect();
        const br = box.getBoundingClientRect();
        const r = (n: number): number => Math.round(n);

        return {
          inset: {
            top: r(pr.top - fr.top),
            right: r(fr.right - pr.right),
            bottom: r(fr.bottom - pr.bottom),
            left: r(pr.left - fr.left),
          },
          box: {
            top: r(br.top - pr.top),
            right: r(br.right - pr.right),
            width: r(br.width),
            height: r(br.height),
          },
        };
      },
      frameSel,
      plateSel,
      boxSel,
    );
  }

  it("the plate frame draws four accent corners in both themes", async () => {
    for (const theme of ["light", "dark"] as const) {
      const p = await open();

      await p.evaluate((t) => {
        if (t === "dark") document.documentElement.dataset.theme = "dark";
        else delete document.documentElement.dataset.theme;
      }, theme);

      await settleFrames(p);

      const read = await p.$eval("#components .plate-frame", (frame) => {
        const probe = document.createElement("span");
        probe.style.color = "var(--accent-1)";
        frame.append(probe);
        const accent = getComputedStyle(probe).color;
        probe.remove();
        const cs = getComputedStyle(frame);

        return {
          accent,
          image: cs.backgroundImage,
          size: cs.backgroundSize,
          stroke: getComputedStyle(frame).getPropertyValue("--stroke").trim(),
        };
      });

      /* Four corners, two strokes each, every layer the accent. */
      const layers = [...read.image.matchAll(/linear-gradient\(/g)];
      expect(layers, `${theme}: ${read.image}`).toHaveLength(8);
      const colors = [...read.image.matchAll(/rgba?\([^)]*\)/g)];
      expect(colors).toHaveLength(16);

      for (const color of colors) {
        expect(color[0], theme).toBe(read.accent);
      }

      const sizes = read.size.split(",").map((s) => s.trim());
      expect(sizes).toHaveLength(8);

      for (const size of sizes) {
        const [w, h] = size.split(" ");

        expect([w, h].sort(), `${theme}: ${size}`).toEqual(
          ["22px", read.stroke].sort(),
        );
      }

      await p.close();
      page = undefined;
    }
  }, 60_000);

  /* Regression (0.15.1): GalleryImage's tile used a scoped class named
     plate-frame, so 0.15.0's global .plate-frame pattern painted accent
     corners and padding onto every gallery tile. A tile is a plain
     outlined image: no corner layers and no padding. */
  it("gallery tiles never pick up the plate frame pattern", async () => {
    const p = await open();
    await settleFrames(p);

    const tiles = await p.$$eval(".gallery-plate > div", (els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);

        return {
          plateFrame: el.classList.contains("plate-frame"),
          image: cs.backgroundImage,
          padding: cs.padding,
        };
      }),
    );

    expect(tiles.length).toBeGreaterThan(0);

    for (const t of tiles) {
      expect(t.plateFrame).toBe(false);
      expect(t.image).toBe("none");
      expect(t.padding).toBe("0px");
    }

    await p.close();
    page = undefined;
  }, 60_000);

  it("the plate frame's corner box opens the sample on the plate modal and Escape puts it back", async () => {
    const p = await open();
    await settleFrames(p);
    await p.click("#components .plate-frame-corner");
    await settleFrames(p);

    const popped = await p.evaluate(() => ({
      open: document.querySelector("dialog[open]")?.getAttribute("aria-label"),
      inModal: !!document.querySelector(
        "dialog[open] .pm-plate [data-plate-frame-content] img",
      ),
      framePopped: !!document.querySelector(
        "#components .plate-frame.is-popped",
      ),
    }));

    expect(popped).toEqual({
      open: "Plate frame sample",
      inModal: true,
      framePopped: true,
    });

    await p.keyboard.press("Escape");
    await settleFrames(p);

    const back = await p.evaluate(() => ({
      open: !!document.querySelector("dialog[open]"),
      inFrame: !!document.querySelector(
        "#components .plate-frame [data-plate-frame-content] img",
      ),
      focus: document.activeElement?.classList.contains("plate-frame-corner"),
    }));

    expect(back).toEqual({ open: false, inFrame: true, focus: true });
    await p.close();
    page = undefined;
  }, 60_000);

  it("the plate frame matches the open plate modal's zone and close box", async () => {
    const p = await open();

    const inline = await frameGeometry(
      p,
      "#components .plate-frame",
      "#components .plate-frame-plate",
      "#components .plate-frame-corner",
    );

    expect(inline.inset).toEqual({ top: 26, right: 30, bottom: 26, left: 30 });

    await p.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);

    await p.click(".demo-path-player");
    await settleFrames(p);

    const modal = await frameGeometry(
      p,
      "dialog[open] .pm-zone",
      "dialog[open] .pm-plate",
      "dialog[open] .pm-close",
    );

    expect(inline.inset).toEqual(modal.inset);
    expect(inline.box).toEqual(modal.box);

    /* The box straddles the plate's top-right corner: its center sits
       within a few px of that corner. */
    expect(Math.abs(inline.box.top + inline.box.height / 2)).toBeLessThan(4);
    expect(Math.abs(inline.box.right - inline.box.width / 2)).toBeLessThan(4);
  });

  it("at phone width the plate frame drops its corners like the modal", async () => {
    const p = await openPhone();

    const inline = await frameGeometry(
      p,
      "#components .plate-frame",
      "#components .plate-frame-plate",
      "#components .plate-frame-corner",
    );

    const image = await p.$eval(
      "#components .plate-frame",
      (f) => getComputedStyle(f).backgroundImage,
    );

    expect(image).toBe("none");
    expect(inline.inset).toEqual({ top: 16, right: 9, bottom: 16, left: 9 });

    await p.emulateMediaFeatures([
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);

    await p.click(".demo-path-player");
    await settleFrames(p);

    const modal = await frameGeometry(
      p,
      "dialog[open] .pm-zone",
      "dialog[open] .pm-plate",
      "dialog[open] .pm-close",
    );

    /* The box moves inside the plate's right edge, as the close box
       does on a phone. */
    expect(inline.box).toEqual(modal.box);
    expect(inline.box.right).toBeLessThan(0);
  });

  it("typing in a clicked joined field keeps the pointer stamp", async () => {
    const p = await open();

    /* The Subscribe demo's field, not the first match on the page: the
       header's search field comes first in the DOM and is hidden until
       the search box opens, so a click there focuses nothing. */
    await p.click("#components .field-join-input");
    await p.keyboard.type("a");

    expect(await p.evaluate(() => document.documentElement.dataset.focus)).toBe(
      "pointer",
    );
  });

  it("the icon set is wired in the head and every icon resolves", async () => {
    const p = await open();

    const hrefs = await p.$$eval(
      'link[rel="icon"], link[rel="apple-touch-icon"]',
      (els) => els.map((el) => el.getAttribute("href") ?? ""),
    );

    expect(new Set(hrefs)).toEqual(
      new Set(["/favicon.svg", "/favicon-32.png", "/apple-touch-icon.png"]),
    );

    for (const href of hrefs) {
      const status = await p.evaluate(
        async (h: string) => (await fetch(h)).status,
        href,
      );

      expect(status, `${href} did not resolve`).toBe(200);
    }
  }, 30_000);

  it("newTab links open a new tab with noopener and a hidden hint, others do not", async () => {
    const p = await open();

    const flagged = await p.$$eval(
      '.footer-sitemap a[href^="https://www.npmjs.com/package/"], .footer-sitemap a[href^="https://github.com/curthenrichs/half-built-ui"]:not([href*="/blob/"])',
      (els) =>
        els.map((a) => ({
          target: a.getAttribute("target"),
          rel: a.getAttribute("rel"),
          hint: a.querySelector(".screen-reader-text")?.textContent ?? "",
        })),
    );

    expect(flagged.length).toBe(4);

    for (const l of flagged) {
      expect(l.target).toBe("_blank");
      expect(l.rel).toBe("noopener");
      expect(l.hint.trim()).toBe("(opens in a new tab)");
    }

    const plain = await p.$$eval(
      '#primary-menu a, .footer-sitemap a[href^="/"]',
      (els) =>
        els.map((a) => [a.getAttribute("target"), a.getAttribute("rel")]),
    );

    expect(plain.length).toBeGreaterThan(0);
    expect(plain.every(([t, r]) => t === null && r === null)).toBe(true);
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
          document.querySelector('[data-toc] a[aria-current="true"]')
            ?.textContent === title,
        { timeout: 5000 },
        section.title,
      );
    }
  }, 60_000);

  it("the footer renders the served fixture, not the live document", async () => {
    const p = await open();

    await p.waitForFunction(() => {
      const el = document.querySelector("footer [data-ecosystem]");
      /* Same two-type-worlds note as palette-editor.ts's copy handler:
         strict DOM sees string | null, the lint project sees string. */

      return (el?.textContent ?? "").includes("Sample Alpha");
    });

    const labels = await p.$$eval("footer [data-ecosystem] li", (els) =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      els.map((el) => el.textContent?.trim() ?? ""),
    );

    expect(labels).toContain("Sample UI");
    expect(labels).toContain("Sample Alpha");
  });

  it("the footer's ecosystem list carries the island's hook and the baseline", async () => {
    const p = await open({ ecosystem: "abort" });
    /* The hook is what mountEcosystem finds. The baseline is what
       renders with JavaScript off forever, and what stands whenever
       the endpoint cannot be reached: this site plus a pointer home
       to the blog.

       The endpoint is blocked rather than fetched (open()'s abort
       mode). Since it went live the island would otherwise replace
       this list with the real document, making the assertion depend
       on a third-party host being up and on the contents of a file in
       another repo. Blocking it tests the fallback path, which is the
       load-bearing promise, and keeps the suite hermetic. The
       fetch-and-replace path is covered against the fixture in the
       test below. */

    /* The island tries three times (the first fetch, then retries at
       about 400ms and 1200ms plus jitter) before it falls back, so wait
       for the third abort, then for the baseline list. */
    await ecosystemAborted(3);

    /* Same two-type-worlds note as palette-editor.ts's copy handler:
       strict DOM sees string | null, the lint project sees string. */
    await p.waitForFunction(() => {
      const nodes = [
        ...document.querySelectorAll("footer [data-ecosystem] li"),
      ];

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const items = nodes.map((el) => el.textContent?.trim() ?? "");

      return (
        items.length === 2 &&
        items[0] === "half-built-ui" &&
        items[1] === "Half-Built Robots"
      );
    });

    const list = await p.$("footer [data-ecosystem]");
    expect(list, "the footer has no data-ecosystem hook").not.toBeNull();

    /* Same two-type-worlds note as palette-editor.ts's copy handler:
       strict DOM sees string | null, the lint project sees string. */
    const items = await p.$$eval("footer [data-ecosystem] li", (els) =>
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      els.map((el) => el.textContent?.trim() ?? ""),
    );

    expect(items).toEqual(["half-built-ui", "Half-Built Robots"]);

    const self = await p.$$eval(
      "footer [data-ecosystem] .footer-sitemap-self",
      (els) =>
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        els.map((el) => el.textContent?.trim() ?? ""),
    );

    expect(self).toEqual(["half-built-ui"]);
  }, 30_000);

  it("the swapped ecosystem list keeps the footer's own styling", async () => {
    /* The complement to the test above. That one blocks the endpoint
       and checks the baseline; this one serves the fixture (open()'s
       default mode) and checks what the island builds, so neither
       touches the network.

       Computed styles, not classes: 0.3.0 shipped an island whose
       markup and classes were correct and whose rendering was not,
       because Astro scopes Footer.astro's rules to a data-astro-cid
       attribute that createElement nodes never carried. Asserting the
       class would have passed straight through the bug. */
    const p = await open();

    await p.waitForFunction(() => {
      const el = document.querySelector("footer [data-ecosystem]");
      /* Same two-type-worlds note as the baseline test above: strict
         DOM sees string | null, the lint project sees string. */

      return (el?.textContent ?? "").includes("Sample Gamma");
    });

    const rendered = await p.$$eval("footer [data-ecosystem] li > *", (els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        /* Same two-type-worlds note as the baseline test above: strict
           DOM sees string | null, the lint project sees string. */

        return {
          text: (el.textContent || "").trim(),
          weight: cs.fontWeight,
          opacity: cs.opacity,
          deco: cs.textDecorationLine,
        };
      }),
    );

    /* The fixture's own family sorts first (self is "ui"), then the
       other family, each ascending by priority: ui, alpha, beta, gamma. */
    expect(rendered.map((r) => r.text)).toEqual([
      "Sample UI",
      "Sample Alpha",
      "Sample Beta",
      "Sample Gamma",
    ]);

    /* You are here, so bold. */
    expect(rendered[0].weight).toBe("700");
    /* The link keeps the footer's underline-on-hover treatment rather
       than falling back to the browser's default underline. */
    expect(rendered[1].deco).toBe("none");
    /* Undeployed, so dimmed. */
    expect(Number(rendered[2].opacity)).toBeLessThan(1);
    expect(rendered[3].deco).toBe("none");
  }, 30_000);

  it("the toc renders one link per section and every href target exists", async () => {
    const p = await open();

    const hrefs = await p.$$eval("[data-toc] a", (els) =>
      els.map((el) => el.getAttribute("href") ?? ""),
    );

    expect(hrefs).toEqual(SECTIONS.map((s) => `#${s.id}`));

    const missing = await p.evaluate(
      (ids: string[]) =>
        ids.filter((id) => document.getElementById(id) === null),
      SECTIONS.map((s) => s.id),
    );

    expect(
      missing,
      `toc targets missing from the page: ${missing.join(", ")}`,
    ).toEqual([]);
  }, 30_000);

  /* The package Toc: the panel form in the rail under the
     Palette knob above the tablet break, the inline disclosure under
     the title at and below it (owner, 2026-11-21: the gutter strip was
     rejected). These pages skip open()'s palette clear and axe
     settling; nothing here reads colors. */
  async function openAt(
    width: number,
    height: number,
    options: { javascript?: boolean } = {},
  ): Promise<Page> {
    if (!browser) throw new Error("no browser (beforeAll failed)");

    const p =
      width <= 390
        ? await phonePage(browser, width, height)
        : await desktopPage(browser, width, height);

    page = p;
    if (options.javascript === false) await p.setJavaScriptEnabled(false);
    await routeEcosystem(p, "fixture");
    await p.goto(`${ORIGIN}/`, { waitUntil: "networkidle0" });

    await p.addStyleTag({
      content:
        "html { scroll-behavior: auto !important; } *, *::before, *::after { transition: none !important; animation: none !important; }",
    });

    return p;
  }

  async function closePage(p: Page): Promise<void> {
    await p.close();
    page = undefined;
  }

  /* Which form renders: a display: none ancestor leaves no box. */
  const shownForms = (p: Page): Promise<{ panel: boolean; inline: boolean }> =>
    p.evaluate(() => {
      const panel = document.querySelector("[data-toc]");
      const inline = document.querySelector("details.toc-inline");
      return {
        panel: panel !== null && panel.getClientRects().length > 0,
        inline: inline !== null && inline.getClientRects().length > 0,
      };
    });

  it("above the tablet break the toc is the panel in the rail, under the palette", async () => {
    for (const [width, height] of [
      [1025, 800],
      [1440, 900],
      [1920, 1080],
    ] as const) {
      const p = await openAt(width, height);

      expect(await shownForms(p), `${String(width)}px`).toEqual({
        panel: true,
        inline: false,
      });

      const place = await p.evaluate(() => {
        const panel = document.querySelector("[data-toc]");
        const knob = document.querySelector(".site-knob > summary");
        const column = document.querySelector("article.static-page");
        if (!panel || !knob || !column) return null;
        const r = panel.getBoundingClientRect();
        const k = knob.getBoundingClientRect();

        /* The label straddles the box's top rule, so it reaches about
           10px above the box. */
        const label = panel
          .querySelector(".toc-label")
          ?.getBoundingClientRect();

        return {
          inRail: panel.closest(".site-rail") !== null,
          belowKnob: (label?.top ?? r.top) >= k.bottom,
          clearOfColumn: r.right <= column.getBoundingClientRect().left,
        };
      });

      expect(place, `${String(width)}px`).toEqual({
        inRail: true,
        belowKnob: true,
        clearOfColumn: true,
      });

      await closePage(p);
    }
  }, 60_000);

  it("at and below the tablet break the toc is the inline disclosure under the title", async () => {
    for (const [width, height] of [
      [1024, 800],
      [768, 1024],
      [390, 664],
    ] as const) {
      const p = await openAt(width, height);

      expect(await shownForms(p), `${String(width)}px`).toEqual({
        panel: false,
        inline: true,
      });

      const place = await p.evaluate(() => {
        const inline = document.querySelector("details.toc-inline");
        const article = inline?.closest("article");
        const h1 = article?.querySelector("h1");
        const section = article?.querySelector("section");
        if (!inline || !article || !h1 || !section) return null;
        const r = inline.getBoundingClientRect();
        const a = article.getBoundingClientRect();
        const cs = getComputedStyle(article);
        return {
          belowTitle: r.top >= h1.getBoundingClientRect().bottom,
          aboveFirstSection: r.bottom <= section.getBoundingClientRect().top,
          insideColumn:
            r.left >= a.left + parseFloat(cs.paddingLeft) - 1 &&
            r.right <= a.right - parseFloat(cs.paddingRight) + 1,
        };
      });

      /* Classes are the hooks; the old script hook is gone (final
         review 2026-11-21). */
      expect(await p.$("[data-toc-inline]"), `${String(width)}px`).toBeNull();

      expect(place, `${String(width)}px`).toEqual({
        belowTitle: true,
        aboveFirstSection: true,
        insideColumn: true,
      });

      await closePage(p);
    }
  }, 60_000);

  it("the two forms carry distinct landmark names", async () => {
    const p = await openAt(1440, 900);

    const names = await p.$$eval("nav", (els) =>
      els
        .filter((el) => el.querySelector(".toc-links"))
        .map((el) => el.getAttribute("aria-label")),
    );

    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
  }, 30_000);

  it("the toc covers nothing at any width", async () => {
    /* The first build's tab overlapped the column's edge below about
       1410px, and the demo's palette knob painted over it between the
       tablet break and about 1410px (owner review 2026-11-18). */
    const tops = { top: 0, middle: 1500, bottom: Number.MAX_SAFE_INTEGER };

    for (const width of [390, 768, 1024, 1100, 1440, 1920]) {
      const p = await openAt(width, 800);

      for (const at of ["top", "middle", "bottom"] as const) {
        const result = await p.evaluate((top: number) => {
          window.scrollTo({ top, behavior: "instant" });
          const panel = document.querySelector("[data-toc]");
          const column = document.querySelector("article.static-page");
          if (!panel || !column) return "markup missing";

          if (panel.getClientRects().length > 0) {
            const r = panel.getBoundingClientRect();
            const c = column.getBoundingClientRect();

            if (r.right > c.left || r.left < 0) {
              return `panel spans ${String(r.left)}..${String(r.right)} against the article at ${String(c.left)}`;
            }
          }

          const knob = document.querySelector(".site-knob > summary");
          if (!knob) return "knob missing";
          const k = knob.getBoundingClientRect();
          const x = k.left + k.width / 2;
          const y = k.top + k.height / 2;
          if (y < 0 || y > window.innerHeight) return "ok";
          const hit = document.elementFromPoint(x, y);
          return hit !== null && knob.contains(hit)
            ? "ok"
            : `something paints over the knob: ${hit?.className ?? "nothing"}`;
        }, tops[at]);

        expect(result, `${String(width)}px, ${at}`).toBe("ok");
      }

      await closePage(p);
    }
  }, 120_000);

  it("every toc link is at least 24px tall", async () => {
    for (const [width, height, list] of [
      [1920, 1080, "[data-toc]"],
      [390, 664, "details.toc-inline"],
    ] as const) {
      const p = await openAt(width, height);

      if (list === "details.toc-inline") {
        await p.click("details.toc-inline > summary");

        const summary = await p.$eval(
          "details.toc-inline > summary",
          (el) => el.getBoundingClientRect().height,
        );

        expect(summary).toBeGreaterThanOrEqual(24);
      }

      const heights = await p.$$eval(`${list} .toc-links a`, (els) =>
        els.map((a) => a.getBoundingClientRect().height),
      );

      expect(heights.length).toBeGreaterThan(0);

      expect(Math.min(...heights), `${String(width)}px`).toBeGreaterThanOrEqual(
        24,
      );

      await closePage(p);
    }
  }, 60_000);

  it("a long toc scrolls inside the panel and the panel fits the viewport", async () => {
    const p = await openAt(1440, 700);

    const result = await p.evaluate(() => {
      const list = document.querySelector("[data-toc] .toc-links");
      const panel = document.querySelector("[data-toc]");
      if (!list || !panel) return null;

      for (let i = 0; i < 30; i++) {
        list.insertAdjacentHTML(
          "beforeend",
          `<li><a href="#intro">Extra ${String(i)}</a></li>`,
        );
      }

      /* Past the page top, where the sticky rail has stuck at 2rem. */
      window.scrollTo({ top: 1000, behavior: "instant" });
      const last = list.querySelector("li:last-child a");
      last?.scrollIntoView({ block: "nearest", behavior: "instant" });
      const l = last?.getBoundingClientRect();
      const r = panel.getBoundingClientRect();
      return {
        scrolls: list.scrollHeight > list.clientHeight,
        inside:
          l !== undefined && l.top >= r.top - 1 && l.bottom <= r.bottom + 1,
        fitsViewport: r.bottom <= window.innerHeight,
      };
    });

    expect(result).toEqual({ scrolls: true, inside: true, fitsViewport: true });
  }, 30_000);

  it("the rail panel fits a short viewport whatever the knob's height", async () => {
    /* Final review 2026-11-21: the panel's cap was the viewport less a
       hand-summed knob height, so a taller knob (larger root text, a
       restyle) pushed the panel's bottom below the fold. */
    const p = await openAt(1440, 600);

    await p.addStyleTag({
      content: ".site-knob > summary { padding-block: 40px !important; }",
    });

    const result = await p.evaluate(() => {
      const list = document.querySelector("[data-toc] .toc-links");
      const panel = document.querySelector("[data-toc]");
      if (!list || !panel) return null;

      for (let i = 0; i < 30; i++) {
        list.insertAdjacentHTML(
          "beforeend",
          `<li><a href="#intro">Extra ${String(i)}</a></li>`,
        );
      }

      window.scrollTo({ top: 1000, behavior: "instant" });
      return {
        scrolls: list.scrollHeight > list.clientHeight,
        fitsViewport:
          panel.getBoundingClientRect().bottom <= window.innerHeight,
      };
    });

    expect(result).toEqual({ scrolls: true, fitsViewport: true });
  }, 30_000);

  it("the disclosure's name is its label and count, not its marker", async () => {
    const p = await openAt(390, 664);
    const summary = await p.$("details.toc-inline > summary");
    if (!summary) throw new Error("no summary");

    const closed = await p.accessibility.snapshot({ root: summary });
    await summary.click();
    const opened = await p.accessibility.snapshot({ root: summary });

    expect(closed?.name).toBe("Sections (5)");
    expect(opened?.name).toBe("Sections (5)");
  }, 30_000);

  it("the inline disclosure opens and jumps", async () => {
    const p = await openAt(390, 664);

    await p.click("details.toc-inline > summary");

    expect(
      await p.$eval("details.toc-inline", (el) => el.hasAttribute("open")),
    ).toBe(true);

    await p.click('details.toc-inline a[href="#cards"]');

    await p.waitForFunction(() => location.hash === "#cards", {
      timeout: 5000,
    });

    const landed = await p.evaluate(() => {
      const target = document.getElementById("cards");
      return {
        top: target ? Math.round(target.getBoundingClientRect().top) : null,
        open:
          document.querySelector("details.toc-inline")?.hasAttribute("open") ??
          false,
      };
    });

    expect(landed.top).not.toBeNull();
    expect(landed.top).toBeGreaterThanOrEqual(-1);
    expect(landed.top).toBeLessThanOrEqual(80);
    expect(landed.open).toBe(true);
  }, 30_000);

  it("without JavaScript each width still shows its one form, unmarked", async () => {
    for (const [width, height, expected] of [
      [1920, 1080, { panel: true, inline: false }],
      [390, 664, { panel: false, inline: true }],
    ] as const) {
      const p = await openAt(width, height, { javascript: false });

      expect(await shownForms(p), `${String(width)}px`).toEqual(expected);

      expect(
        await p.$$eval("[data-toc] [aria-current]", (els) => els.length),
      ).toBe(0);

      await closePage(p);
    }
  }, 60_000);

  it("the fixed corner knob never covers the footer's links", async () => {
    /* At the tablet break and below the rail is a fixed corner knob
       (site.css), so nothing in flow makes room for it. Before the
       2026-09-09 fix the footer's last links sat under it: Portfolio
       and Okos Polip at phone widths, the Site group's Components and
       CSS at tablet widths, where the sitemap's leftmost column starts
       inside the knob's span. Every collapsible group is opened
       first so the longest possible footer is what has to clear, and
       the knob's own panel stays closed: an open panel covering the
       page is the design, the closed knob covering it is the bug. */
    if (!browser) throw new Error("no browser (beforeAll failed)");
    const b = browser;

    const viewports: { name: string; open: () => Promise<Page> }[] = [
      { name: "phone", open: () => phonePage(b) },
      { name: "tablet", open: () => desktopPage(b, 900, 800) },
    ];

    for (const viewport of viewports) {
      const p = await viewport.open();
      page = p;
      await routeEcosystem(p, "fixture");
      await p.goto(`${ORIGIN}/`, { waitUntil: "networkidle0" });

      const covered = await p.evaluate(() => {
        document
          .querySelectorAll(".footer-sitemap-collapsible")
          .forEach((d) => {
            d.setAttribute("open", "");
          });

        /* Instant, not the reset's smooth scroll: a smooth scrollTo
           animates, and the rects read next would still describe the
           page top. */
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "instant",
        });

        const rail = document.querySelector(".site-rail");

        if (!rail || getComputedStyle(rail).position !== "fixed") {
          return ["(no fixed rail at this width)"];
        }

        const r = rail.getBoundingClientRect();
        return (
          [
            ...document.querySelectorAll(
              ".footer-sitemap a, .footer-sitemap span, .footer-sitemap h2",
            ),
          ]
            .filter((el) => {
              const b = el.getBoundingClientRect();
              return (
                b.width > 0 &&
                b.left < r.right &&
                b.right > r.left &&
                b.top < r.bottom &&
                b.bottom > r.top
              );
            })
            /* Same two-type-worlds note as palette-editor.ts's copy
             handler: strict DOM sees string | null, the lint project
             sees string. */
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            .map((el) => el.textContent?.trim() ?? "")
        );
      });

      expect(
        covered,
        `${viewport.name}: footer text under the corner knob`,
      ).toEqual([]);

      await p.close();
      page = undefined;
    }
  }, 30_000);

  /* Every overlay the demo opens is topmost over what it covers
     (2026-11-21). The palette panel once painted under the rail's
     TOC panel: both were z-index: auto inside the rail's stacking
     context, so DOM order decided. Each test opens the overlay the way
     a user does, then samples a 4x4 grid inside its box, inset from the
     edges, and asks elementFromPoint who is there. A test also asserts
     that the overlay really overlaps the thing it could lose to, so it
     cannot pass by never meeting it. */
  const coversItself = (
    p: Page,
    selector: string,
    skip?: string,
  ): Promise<string[]> =>
    p.evaluate(
      (sel: string, skipSel: string | null) => {
        const overlay = document.querySelector(sel);
        if (!overlay) return [`${sel}: not found`];

        /* Clamped to the viewport: elementFromPoint answers null off
           screen, which says nothing about stacking. */
        const full = overlay.getBoundingClientRect();

        const r = {
          left: Math.max(full.left, 0),
          top: Math.max(full.top, 0),
          width:
            Math.min(full.right, window.innerWidth) - Math.max(full.left, 0),
          height:
            Math.min(full.bottom, window.innerHeight) - Math.max(full.top, 0),
        };

        const skipped = skipSel
          ? [...document.querySelectorAll(skipSel)].map((el) =>
              el.getBoundingClientRect(),
            )
          : [];

        const inset = 6;
        const misses: string[] = [];

        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) {
            const x = r.left + inset + ((r.width - 2 * inset) * i) / 3;
            const y = r.top + inset + ((r.height - 2 * inset) * j) / 3;

            if (
              skipped.some(
                (s) =>
                  x >= s.left && x <= s.right && y >= s.top && y <= s.bottom,
              )
            ) {
              continue;
            }

            const hit = document.elementFromPoint(x, y);

            if (!hit || !overlay.contains(hit)) {
              misses.push(
                `(${String(Math.round(x))},${String(Math.round(y))}) hits ${
                  hit ? hit.tagName.toLowerCase() : "nothing"
                }.${hit ? (hit.getAttribute("class") ?? "") : ""}`,
              );
            }
          }
        }

        return misses;
      },
      selector,
      skip ?? null,
    );

  const boxesOverlap = (p: Page, a: string, b: string): Promise<boolean> =>
    p.evaluate(
      (selA: string, selB: string) => {
        const ea = document.querySelector(selA);
        const eb = document.querySelector(selB);

        if (!ea || !eb) return false;

        const ra = ea.getBoundingClientRect();
        const rb = eb.getBoundingClientRect();

        return (
          ra.left < rb.right &&
          ra.right > rb.left &&
          ra.top < rb.bottom &&
          ra.bottom > rb.top
        );
      },
      a,
      b,
    );

  /* The grid can step over a small neighbor (the corner knob is 40px
     under a menu hundreds wide), so the shared region gets its own
     probes: the center of the intersection of the two boxes. */
  const coversShared = (
    p: Page,
    overlaySel: string,
    otherSel: string,
  ): Promise<string> =>
    p.evaluate(
      (selA: string, selB: string) => {
        const overlay = document.querySelector(selA);
        const other = document.querySelector(selB);

        if (!overlay || !other) return "missing";

        const a = overlay.getBoundingClientRect();
        const b = other.getBoundingClientRect();

        const x =
          (Math.max(a.left, b.left, 0) +
            Math.min(a.right, b.right, window.innerWidth)) /
          2;

        const y =
          (Math.max(a.top, b.top, 0) +
            Math.min(a.bottom, b.bottom, window.innerHeight)) /
          2;

        const hit = document.elementFromPoint(x, y);

        return hit && overlay.contains(hit)
          ? ""
          : `(${String(Math.round(x))},${String(Math.round(y))}) hits ${
              hit ? hit.tagName.toLowerCase() : "nothing"
            }`;
      },
      overlaySel,
      otherSel,
    );

  it("the open palette panel is on top at 1440, over the rail toc panel", async () => {
    const p = await openAt(1440, 900);

    await p.click(".site-knob > summary");

    expect(
      await boxesOverlap(p, ".site-toolbar-body", ".toc-panel"),
      "the panel must reach the toc panel or this proves nothing",
    ).toBe(true);

    expect(
      await coversItself(p, ".site-toolbar-body", ".site-toolbar-close"),
    ).toEqual([]);

    await closePage(p);
  }, 30_000);

  it("the open palette panel is on top at the tablet corner and the phone", async () => {
    for (const [width, height] of [
      [1024, 800],
      [390, 844],
    ] as const) {
      const p = await openAt(width, height);

      await p.click(".site-knob > summary");

      /* At these widths the knob is a fixed corner control and the
         panel opens up over the page content; no positioned sibling
         shares its stacking context, so this is a regression guard
         that the panel stays over the page it covers. */
      expect(
        await boxesOverlap(p, ".site-toolbar-body", "main"),
        `${String(width)}px: the panel must sit over page content`,
      ).toBe(true);

      expect(
        await coversItself(p, ".site-toolbar-body", ".site-toolbar-close"),
        `${String(width)}px`,
      ).toEqual([]);

      await closePage(p);
    }
  }, 60_000);

  it("the open mobile menu is on top of the corner knob", async () => {
    const p = await openAt(390, 480);

    await p.click(".menu-toggle");

    expect(
      await boxesOverlap(p, "#primary-menu", ".site-rail"),
      "the open menu must reach the fixed knob or this proves nothing",
    ).toBe(true);

    expect(await coversItself(p, "#primary-menu")).toEqual([]);
    expect(await coversShared(p, "#primary-menu", ".site-rail")).toBe("");

    await closePage(p);
  }, 30_000);

  /* The center of one element lands inside another: a single probe
     where the grid would step over a small target. */
  const centerLandsIn = (
    p: Page,
    probeSel: string,
    insideSel: string,
  ): Promise<string> =>
    p.evaluate(
      (probe: string, inside: string) => {
        const target = document.querySelector(probe);
        const host = document.querySelector(inside);

        if (!target || !host) return `missing ${!target ? probe : inside}`;

        const r = target.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const hit = document.elementFromPoint(x, y);

        return hit && host.contains(hit)
          ? ""
          : `(${String(Math.round(x))},${String(Math.round(y))}) hits ${
              hit ? hit.tagName.toLowerCase() : "nothing"
            }.${hit ? (hit.getAttribute("class") ?? "") : ""}`;
      },
      probeSel,
      insideSel,
    );

  it("the open palette's corner X and the panel over the Sections label are hit where they paint", async () => {
    const p = await openAt(1440, 900);

    await p.click(".site-knob > summary");

    /* The X straddles the panel's corner, so the grid skips it; it
       still has to take its own clicks. */
    expect(
      await centerLandsIn(p, ".site-toolbar-close", ".site-toolbar-close"),
    ).toBe("");

    /* The Sections label straddles the toc panel's top rule, right
       where the open palette panel comes down over it. */
    expect(
      await boxesOverlap(p, ".site-toolbar-body", ".toc-panel .toc-label"),
      "the panel must cover the Sections label or this proves nothing",
    ).toBe(true);

    expect(
      await centerLandsIn(p, ".toc-panel .toc-label", ".site-toolbar-body"),
    ).toBe("");

    await closePage(p);
  }, 30_000);

  it("the open popout is on top at desktop, anchored on the ladder", async () => {
    /* Above phone width popout.ts opens its dialog with show(): not
       modal, so it is not in the top layer and holds its place by
       --z-popout alone, over the table it drops across. */
    const p = await openAt(1440, 900);

    await p.click("#demo-popout-2");

    expect(
      await p.$eval("dialog.popout", (el) => ({
        open: el.open,
        modal: el.matches(":modal"),
      })),
      "the popout did not open anchored",
    ).toEqual({ open: true, modal: false });

    expect(
      await boxesOverlap(p, "dialog.popout", "section.table-scroll table"),
      "the popout must drop over the table or this proves nothing",
    ).toBe(true);

    expect(await coversItself(p, "dialog.popout")).toEqual([]);

    expect(
      await coversShared(p, "dialog.popout", "section.table-scroll table"),
    ).toBe("");

    await closePage(p);
  }, 30_000);

  it("the open popout's phone sheet is on top at 390", async () => {
    /* At phone width the same dialog opens with showModal() as a
       bottom sheet in the top layer, outside the ladder. */
    const p = await openAt(390, 844);

    await p.$eval("#demo-popout-2", (el) => {
      el.scrollIntoView({ block: "center" });
    });

    await p.click("#demo-popout-2");

    expect(
      await p.$eval("dialog.popout", (el) => ({
        open: el.open,
        modal: el.matches(":modal"),
      })),
      "the popout did not open as the sheet",
    ).toEqual({ open: true, modal: true });

    expect(
      await boxesOverlap(p, "dialog.popout", "main"),
      "the sheet must sit over page content",
    ).toBe(true);

    expect(await coversItself(p, "dialog.popout")).toEqual([]);

    await closePage(p);
  }, 30_000);

  it("a link tip from inside the open popout paints over the popout", async () => {
    const p = await openAt(1440, 900);

    await p.click("#demo-popout-1");

    await p.waitForFunction(() => {
      const s = document.querySelector("dialog.popout");
      return s instanceof HTMLDialogElement && s.open;
    });

    await p.hover("dialog.popout .popout-body a");
    await p.waitForSelector(".link-tip.is-open", { timeout: 5000 });

    expect(
      await boxesOverlap(p, ".link-tip", "dialog.popout"),
      "the tip must reach the popout or this proves nothing",
    ).toBe(true);

    /* The tip is pointer-events: none so it never steals its own hover,
       which also hides it from hit testing. It takes hits only for the
       length of this synchronous probe; nothing moves, so no event
       fires in between. */
    const probe = await p.evaluate(() => {
      const tip = document.querySelector(".link-tip");
      const box = document.querySelector("dialog.popout");

      if (!(tip instanceof HTMLElement) || !box) return "missing";

      const t = tip.getBoundingClientRect();
      const b = box.getBoundingClientRect();

      const points = [
        [t.left + t.width / 2, t.top + t.height / 2],
        [
          (Math.max(t.left, b.left) + Math.min(t.right, b.right)) / 2,
          (Math.max(t.top, b.top) + Math.min(t.bottom, b.bottom)) / 2,
        ],
      ];

      tip.style.pointerEvents = "auto";

      const misses = points.flatMap(([x, y]) => {
        const hit = document.elementFromPoint(x, y);

        return hit && tip.contains(hit)
          ? []
          : [
              `(${String(Math.round(x))},${String(Math.round(y))}) hits ${
                hit ? hit.tagName.toLowerCase() : "nothing"
              }.${hit ? (hit.getAttribute("class") ?? "") : ""}`,
            ];
      });

      tip.style.pointerEvents = "";

      return misses.join("; ");
    });

    expect(probe).toBe("");

    await closePage(p);
  }, 30_000);

  /* The overlay rule's second half, checked over the whole page rather
     than one overlay at a time: no element on a page rung (z-index at
     or over --z-skip-link) may sit inside a stacking context with a
     lower z-index than its own, short of the root. Such a context caps
     the element at the context's rung, whatever its own z-index says.
     Top-layer dialogs are outside every context and are skipped. The
     check covers what the demo renders: an overlay the demo does not
     show is not checked, so a new overlay must be demoed to be
     covered. Pages run with transitions and animations off (openAt),
     so a context that exists only mid-animation is not seen. Given a
     floating selector, the check also reports when that element is not
     among the page-rung elements it walked (or the skipped top-layer
     ones), so a check of a closed or missing overlay cannot pass. */
  const cappedLayers = (p: Page, floating?: string): Promise<string[]> =>
    p.evaluate((floatingSel: string | null) => {
      const nameOf = (el: Element): string => {
        const id = el.id ? `#${el.id}` : "";

        const classes = [...el.classList]
          .slice(0, 3)
          .map((c) => `.${c}`)
          .join("");

        return `${el.tagName.toLowerCase()}${id}${classes}`;
      };

      const zOf = (cs: CSSStyleDeclaration): number =>
        cs.zIndex === "auto" ? 0 : Number(cs.zIndex);

      const CONTEXT_WILL_CHANGE = new Set([
        "transform",
        "translate",
        "rotate",
        "scale",
        "opacity",
        "filter",
        "backdrop-filter",
        "perspective",
        "clip-path",
        "mask",
        "mask-image",
        "isolation",
        "mix-blend-mode",
        "contain",
        "position",
        "z-index",
        "offset-path",
        "view-transition-name",
        "mask-border",
        "mask-border-source",
        "-webkit-mask-box-image",
        "-webkit-mask-box-image-source",
      ]);

      /* Why an element forms a stacking context, or "" if it does not. */
      const contextReason = (el: Element): string => {
        const cs = getComputedStyle(el);

        const parent = el.parentElement
          ? getComputedStyle(el.parentElement).display
          : "";

        const item = /\b(flex|grid)\b/.test(parent);

        if (cs.position === "fixed" || cs.position === "sticky") {
          return `position: ${cs.position}`;
        }

        if (cs.zIndex !== "auto" && (cs.position !== "static" || item)) {
          return `z-index: ${cs.zIndex} on a positioned or flex/grid item`;
        }

        if (Number(cs.opacity) < 1) return `opacity: ${cs.opacity}`;

        for (const prop of [
          "transform",
          "translate",
          "rotate",
          "scale",
          "filter",
          "backdrop-filter",
          "perspective",
          "clip-path",
          "mask-image",
          "-webkit-mask-image",
          "mask-border-source",
          "-webkit-mask-box-image-source",
          "offset-path",
          "view-transition-name",
        ]) {
          const v = cs.getPropertyValue(prop);
          if (v && v !== "none") return `${prop}: ${v}`;
        }

        if (cs.isolation === "isolate") return "isolation: isolate";

        if (/\b(paint|layout|strict|content)\b/.test(cs.contain)) {
          return `contain: ${cs.contain}`;
        }

        const will = cs.willChange
          .split(",")
          .map((w) => w.trim())
          .filter((w) => CONTEXT_WILL_CHANGE.has(w));

        if (will.length > 0) return `will-change: ${will.join(", ")}`;

        if (cs.mixBlendMode !== "normal") {
          return `mix-blend-mode: ${cs.mixBlendMode}`;
        }

        if (cs.containerType !== "normal") {
          return `container-type: ${cs.containerType}`;
        }

        return "";
      };

      const root = getComputedStyle(document.documentElement);
      const floor = Number(root.getPropertyValue("--z-skip-link").trim());

      if (!Number.isFinite(floor) || floor <= 0) {
        return [`--z-skip-link did not resolve: "${String(floor)}"`];
      }

      const offenders: string[] = [];
      const seen = new Set<Element>();

      for (const el of document.querySelectorAll("*")) {
        if (el.matches(":modal")) {
          seen.add(el);
          continue;
        }

        const cs = getComputedStyle(el);
        if (cs.zIndex === "auto") continue;

        const z = Number(cs.zIndex);
        if (z < floor) continue;

        seen.add(el);

        for (
          let a = el.parentElement;
          a && a !== document.documentElement;
          a = a.parentElement
        ) {
          if (a.matches(":modal")) break;

          const reason = contextReason(a);
          const az = zOf(getComputedStyle(a));

          if (reason && az < z) {
            offenders.push(
              `${nameOf(el)} (z ${String(z)}) is capped by ${nameOf(a)} (z ${String(az)}, ${reason})`,
            );
          }
        }
      }

      if (floatingSel !== null) {
        const target = document.querySelector(floatingSel);

        if (!target || !seen.has(target)) {
          offenders.push(
            `${floatingSel} is not among the page-rung or top-layer elements checked`,
          );
        }
      }

      return offenders;
    }, floating ?? null);

  /* Waits for an overlay's open state: "" once it holds, otherwise
     what never became true. */
  const waitOpen = async (
    p: Page,
    what: string,
    check: () => boolean,
  ): Promise<string> => {
    try {
      await p.waitForFunction(check, { timeout: 5000 });
      return "";
    } catch {
      return `${what} never held`;
    }
  };

  /* Each overlay the demo opens, opened the way a user does. open
     returns "" once the overlay is really open, or why it is not;
     floating is the element that must be among those checked. */
  const OVERLAYS: Record<
    string,
    {
      floating: string | null;
      open: (p: Page, width: number) => Promise<string>;
    }
  > = {
    "nothing open": { floating: null, open: () => Promise.resolve("") },
    "palette panel": {
      floating: ".site-toolbar-body",
      open: async (p) => {
        await p.click(".site-knob > summary");

        return waitOpen(p, ".site-knob[open]", () =>
          Boolean(document.querySelector(".site-knob[open]")),
        );
      },
    },
    "mobile menu": {
      floating: "#primary-menu",
      open: async (p) => {
        await p.click(".menu-toggle");

        return waitOpen(p, "#primary-menu.open", () =>
          Boolean(document.querySelector("#primary-menu.open")),
        );
      },
    },
    popout: {
      floating: "dialog.popout",
      open: async (p, width) => {
        await p.$eval("#demo-popout-2", (el) => {
          el.scrollIntoView({ block: "center" });
        });

        await p.click("#demo-popout-2");

        const state = await waitOpen(p, "dialog.popout[open]", () => {
          const d = document.querySelector("dialog.popout");
          return d instanceof HTMLDialogElement && d.open;
        });

        if (state) return state;

        /* The phone sheet is modal (top layer); wider, it is not. */
        const want = width <= 390;

        const modal = await p.$eval("dialog.popout", (d) =>
          d.matches(":modal"),
        );

        return modal === want
          ? ""
          : `dialog.popout is ${modal ? "" : "not "}modal at ${String(width)}px`;
      },
    },
  };

  /* The menu toggle shows only at and below 991px, so the menu runs at
     390 alone. */
  const STATES = [
    {
      width: 1440,
      height: 900,
      open: ["nothing open", "palette panel", "popout"],
    },
    {
      width: 1024,
      height: 800,
      open: ["nothing open", "palette panel", "popout"],
    },
    {
      width: 390,
      height: 844,
      open: ["nothing open", "palette panel", "mobile menu", "popout"],
    },
  ];

  it("no page layer sits inside a lower stacking context, with each overlay open", async () => {
    const found: string[] = [];
    const ran: string[] = [];

    for (const { width, height, open } of STATES) {
      for (const name of open) {
        const overlay = OVERLAYS[name];
        const p = await openAt(width, height);

        try {
          const problem = await overlay.open(p, width);

          if (problem) {
            found.push(
              `${String(width)}px, ${name}: did not open (${problem})`,
            );
          } else {
            ran.push(`${String(width)}px ${name}`);

            const lines = await cappedLayers(p, overlay.floating ?? undefined);

            for (const line of lines) {
              found.push(`${String(width)}px, ${name}: ${line}`);
            }
          }
        } finally {
          await closePage(p);
        }
      }
    }

    expect(found).toEqual([]);

    expect(ran).toEqual(
      STATES.flatMap(({ width, open }) =>
        open.map((name) => `${String(width)}px ${name}`),
      ),
    );
  }, 120_000);

  /* Controls: the check must be able to fail, for every trigger it
     claims to detect. Each plants one context-forming style on the
     layout wrapper, a z-auto ancestor of the rail, and expects the rail
     reported as capped by it with that reason. */
  it.each([
    ["transform: translateZ(0)", "transform:"],
    ["translate: 1px", "translate:"],
    ["rotate: 1deg", "rotate:"],
    ["scale: 0.99", "scale:"],
    ["filter: blur(0)", "filter:"],
    ["backdrop-filter: blur(1px)", "backdrop-filter:"],
    ["perspective: 100px", "perspective:"],
    ["clip-path: inset(0)", "clip-path:"],
    ["mask-image: linear-gradient(black, black)", "mask-image:"],
    /* Chrome ships mask-border only in its -webkit-mask-box-image
       form, so that is the one plantable here; the unprefixed name is
       still detected for engines that have it. */
    [
      "-webkit-mask-box-image-source: linear-gradient(black, black)",
      "-webkit-mask-box-image-source:",
    ],
    ['offset-path: path("M 0 0 H 1")', "offset-path:"],
    ["view-transition-name: planted", "view-transition-name:"],
    ["opacity: 0.99", "opacity:"],
    ["isolation: isolate", "isolation: isolate"],
    ["contain: paint", "contain:"],
    ["will-change: transform", "will-change: transform"],
    ["will-change: view-transition-name", "will-change: view-transition-name"],
    ["mix-blend-mode: multiply", "mix-blend-mode:"],
    ["container-type: inline-size", "container-type:"],
    ["position: relative; z-index: 0", "z-index: 0"],
  ])(
    "the stacking-context check catches a planted %s",
    async (style, reason) => {
      const p = await openAt(1440, 900);

      try {
        await p.addStyleTag({ content: `.site-layout { ${style}; }` });

        const found = await cappedLayers(p);

        expect(
          found.filter(
            (line) =>
              line.startsWith("aside.site-rail") &&
              line.includes("div.site-layout") &&
              line.includes(reason),
          ),
          found.join("\n"),
        ).toHaveLength(1);
      } finally {
        await closePage(p);
      }
    },
    30_000,
  );

  it("the footer's site-info is the copyright line alone", async () => {
    /* The site-name home link under the copyright retired (owner call
       2026-09-14). The masthead and the Ecosystem group's bold entry
       already say where you are. Read in the browser so the rendered
       text, line breaks included, is the measure. */
    if (!browser) throw new Error("no browser (beforeAll failed)");
    const p = await desktopPage(browser, 1400, 900);
    page = p;
    await routeEcosystem(p, "fixture");
    await p.goto(`${ORIGIN}/`, { waitUntil: "networkidle0" });

    const info = await p.$eval("footer .site-info", (el) => ({
      text: (el as HTMLElement).innerText.trim(),
      links: el.querySelectorAll("a").length,
    }));

    expect(info.text).toMatch(/^Copyright © \d{4} \S/);
    expect(info.text, "one line, no site name under it").not.toContain("\n");
    expect(info.links, "no home link in the copyright block").toBe(0);

    await p.close();
    page = undefined;
  }, 30_000);

  it("a saved palette paints from the head stamp, before any module script runs", async () => {
    /* Owner report 2026-09-13: on a cold load over a slow network the
       page showed the shipped amber until the bundle arrived, derived
       the ramp, and repainted. The editor now stores the derived ramp
       beside the bases and Base.astro sets those properties from an
       inline head script, the same way Shell stamps the theme. Proven
       here by seeding storage the way the editor writes it, then
       blocking every module script: if the palette still lands, the
       bundle was not what painted it. */
    const p = await open();
    await p.click("[data-palette-editor] summary");

    await p.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>(
        'input[data-palette-base="1"]',
      );

      if (!input) throw new Error("no base-1 input");
      input.value = "#2f9e44";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    /* the editor applies, and so stores, a pick on the next frame */
    await p.waitForFunction(
      () => localStorage.getItem("hbui-palette") !== null,
    );

    const saved = await p.evaluate(() => localStorage.getItem("hbui-palette"));
    expect(saved, "the editor wrote nothing to storage").not.toBeNull();
    await p.close();

    if (!browser) throw new Error("no browser (beforeAll failed)");
    const cold = await desktopPage(browser);
    page = cold;

    await cold.evaluateOnNewDocument((raw: string) => {
      localStorage.clear();
      localStorage.setItem("hbui-palette", raw);
    }, saved ?? "");

    /* Fixture mode for ecosystem.json (this test asserts nothing about
       the footer, but the suite is hermetic end to end: nothing here
       may reach the live endpoint), plus the /_astro/ script block
       this test is actually about, both through routeEcosystem's one
       handler. */
    let blocked = 0;

    await routeEcosystem(cold, "fixture", (req) => {
      if (req.resourceType() !== "script" || !req.url().includes("/_astro/")) {
        return false;
      }

      blocked += 1;
      void req.abort();
      return true;
    });

    await cold.goto(`${ORIGIN}/`, { waitUntil: "networkidle0" });

    const brand1500 = await cold.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--brand-1-500")
        .trim(),
    );

    expect(
      blocked,
      "no module script was requested, so nothing was proven",
    ).toBeGreaterThan(0);

    expect(brand1500).toBe("#2f9e44");
  }, 30_000);

  it("the StatLedger demo is a dl with one row of three cells, the third accented", async () => {
    const p = await open();

    const cells = await p.$$eval("#components .stat-ledger dl > div", (els) =>
      els.map((e) => ({
        left: Math.round(e.getBoundingClientRect().left),
        top: Math.round(e.getBoundingClientRect().top),
        dt: e.querySelector("dt")?.textContent.trim() ?? "",
        accent:
          e
            .querySelector("dd")
            ?.classList.contains("stat-ledger-value-accent") ?? false,
      })),
    );

    expect(cells.map((c) => c.dt)).toEqual(["Sample A", "Sample B", "Ratio"]);
    expect(new Set(cells.map((c) => c.top)).size).toBe(1);
    expect(new Set(cells.map((c) => c.left)).size).toBe(3);
    expect(cells.map((c) => c.accent)).toEqual([false, false, true]);

    expect(
      await p.$eval("#components section.stat-ledger", (el) =>
        el.getAttribute("aria-label"),
      ),
    ).toBe("Sample figures");
  });

  it("at phone width the StatLedger stacks and its long value stays inside the box", async () => {
    const p = await openPhone();

    const geo = await p.$eval("#components .stat-ledger", (el) => {
      const box = el.getBoundingClientRect();

      const cells = [...el.querySelectorAll("dl > div")].map((c) => {
        const r = c.getBoundingClientRect();
        return { left: Math.round(r.left), right: r.right };
      });

      return {
        right: box.right,
        cells,
        page: document.documentElement.scrollWidth,
        vw: window.innerWidth,
      };
    });

    expect(new Set(geo.cells.map((c) => c.left)).size).toBe(1);

    for (const c of geo.cells) {
      expect(c.right).toBeLessThanOrEqual(geo.right + 0.5);
    }

    expect(geo.page).toBeLessThanOrEqual(geo.vw);
  });
});
