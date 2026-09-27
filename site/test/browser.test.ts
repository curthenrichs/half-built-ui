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
import {
  startPreview,
  stopPreview,
  launchChrome,
  desktopPage,
  phonePage,
} from "@half-built/tooling/test-kit/browser-server.ts";
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
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
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
  async function openPhone(): Promise<Page> {
    if (!browser) throw new Error("no browser (beforeAll failed)");
    const p = await phonePage(browser);
    page = p;
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

  it("has no WCAG 2.1 AA violations in the light theme", async () => {
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

  it("has no WCAG 2.1 AA violations in the dark theme", async () => {
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

    const brand1500 = await p.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--brand-1-500")
        .trim(),
    );

    expect(brand1500).toBe("#2f9e44");

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
    await new Promise((resolve) => setTimeout(resolve, 50));

    const second = await p.$eval("dialog.popout", (s) => ({
      open: s.open,
      label: s.querySelector(".popout-label")?.textContent ?? "",
      hasLink: s.querySelector(".popout-body a") !== null,
    }));

    expect(second).toEqual({ open: true, label: "Row one", hasLink: true });
  });

  it("the Popout subsection ships a worked example matching the demo", async () => {
    const p = await open();

    const text = await p.$eval(
      ".demo-popout-sample",
      (el) => el.textContent || "",
    );

    expect(text).toContain("<Popout");
    expect(text).toContain("mountPopouts");
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
    await new Promise((resolve) => setTimeout(resolve, 50));

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

    /* Shift+Tab out of the box (it sits last in <body>, so this lands
       on the page's last focusable) closes it and does not pull focus
       back to the trigger. */
    await p.keyboard.press("Enter");
    expect(await popoutOpen(p)).toBe(true);
    await p.keyboard.down("Shift");
    await p.keyboard.press("Tab");
    await p.keyboard.up("Shift");
    await settleFrames(p);
    expect(await popoutOpen(p)).toBe(false);
    expect(await activeId(p)).not.toBe("demo-popout-1");

    expect(
      await p.evaluate(() => document.activeElement !== document.body),
    ).toBe(true);
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
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await popoutOpen(p)).toBe(true);
    expect(await p.evaluate(() => window.scrollY)).toBe(before);

    await p.keyboard.press("Escape");
    await settleFrames(p);
    expect(await popoutOpen(p)).toBe(false);
    expect(await p.evaluate(() => window.scrollY)).toBe(before);

    /* The same wheel scrolls the page once the sheet is gone, so the
       held scroll above was the lock and not a dead gesture. */
    await p.mouse.wheel({ deltaY: 400 });
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(await p.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  });

  it("has no WCAG 2.1 AA violations with the sheet open at phone width", async () => {
    const p = await openPhone();
    await p.click("#demo-popout-1");
    expect(await popoutOpen(p)).toBe(true);
    const violations = await runAxe(p);

    expect(violations, report("phone, sheet open", violations)).toEqual([]);
  }, 60_000);

  it("has no WCAG 2.1 AA violations with a popout open, in both themes", async () => {
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
          document.querySelector('.site-rail-toc a[aria-current="true"]')
            ?.textContent === title,
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
      void (req.url().includes("ecosystem.json")
        ? req.abort()
        : req.continue());
    });

    await p.reload({ waitUntil: "networkidle0" });
    /* The island keeps its last good document in localStorage for a
       day and falls back to it once its retries (400ms, then 1200ms,
       plus jitter) are spent. open()'s evaluateOnNewDocument clear
       runs again on this reload, so the copy the first load cached is
       gone before the island mounts; that is what makes the blocked
       fetch land on the baseline rather than the cached document (the
       blog's copy of this test learned that in CI on 2026-09-09).
       networkidle0 fires between the retries, so wait the chain out
       before asserting: "stands" means after the fallback ran, not
       before it. */
    await new Promise((r) => setTimeout(r, 2500));
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
        {
          key: "blog",
          label: "Half-Built Robots",
          href: "https://half-built-robots.com/",
          priority: 0,
          family: "half-built",
        },
        {
          key: "beadz",
          label: "The Bead Reserve",
          href: null,
          priority: 1,
          family: "half-built",
        },
        {
          key: "ui",
          label: "half-built-ui",
          href: null,
          priority: 3,
          family: "half-built",
        },
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

        return {
          text: (el.textContent || "").trim(),
          weight: cs.fontWeight,
          opacity: cs.opacity,
          deco: cs.textDecorationLine,
        };
      }),
    );

    expect(rendered.map((r) => r.text)).toEqual([
      "Half-Built Robots",
      "The Bead Reserve",
      "half-built-ui",
    ]);

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

    const hrefs = await p.$$eval(".site-rail-toc a", (els) =>
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

  it("the fixed corner cluster never covers the footer's links", async () => {
    /* At the tablet break and below the rail is a fixed corner cluster
       (site.css), so nothing in flow makes room for it. Before the
       2026-09-09 fix the footer's last links sat under it: Portfolio
       and Okos Polip at phone widths, the Site group's Components and
       CSS at tablet widths, where the sitemap's leftmost column starts
       inside the cluster's span. Every collapsible group is opened
       first so the longest possible footer is what has to clear, and
       the cluster's own panels stay closed: an open panel covering the
       page is the design, the closed knobs covering it is the bug. */
    if (!browser) throw new Error("no browser (beforeAll failed)");
    const b = browser;

    const viewports: { name: string; open: () => Promise<Page> }[] = [
      { name: "phone", open: () => phonePage(b) },
      { name: "tablet", open: () => desktopPage(b, 900, 800) },
    ];

    for (const viewport of viewports) {
      const p = await viewport.open();
      page = p;
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
        `${viewport.name}: footer text under the corner cluster`,
      ).toEqual([]);

      await p.close();
      page = undefined;
    }
  }, 30_000);

  it("the footer's site-info is the copyright line alone", async () => {
    /* The site-name home link under the copyright retired (owner call
       2026-09-14). The masthead and the Ecosystem group's bold entry
       already say where you are. Read in the browser so the rendered
       text, line breaks included, is the measure. */
    if (!browser) throw new Error("no browser (beforeAll failed)");
    const p = await desktopPage(browser, 1400, 900);
    page = p;
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

    await cold.setRequestInterception(true);
    let blocked = 0;

    cold.on("request", (req) => {
      if (req.resourceType() === "script" && req.url().includes("/_astro/")) {
        blocked += 1;
        void req.abort();
      } else {
        void req.continue();
      }
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
});
