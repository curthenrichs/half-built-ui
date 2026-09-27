# Audit package fixes (0.11.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every package-side finding of the 2026-09-27 audit, the site's own findings, and the demo-coverage gaps, on `dev`, before Curt tags v0.11.0.

**Architecture:** Small, independent fixes grouped by file family: css tokens, css docs, one task per island family, component docs, tooling, then the demo site. Each behavior fix is test-first (jsdom package tests, or the site's real-Chrome browser suite where jsdom cannot see the behavior). No version bump: 0.11.0 is unreleased.

**Tech Stack:** Astro 5.18, TypeScript, plain CSS with cascade layers, vitest 2 (jsdom for package DOM tests), puppeteer-core + axe for the site browser suite, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-27-audit-package-fixes-design.md`. The audit with every finding's file:line is `docs/superpowers/reviews/2026-09-27-code-audit.md` (appendices).

## Global Constraints

- Work in `C:\Users\curth\Documents\half-built-ecosystem\half-built-ui` on branch `dev`. Commit locally; never push, never tag.
- No version changes: all three packages and the site pins stay `0.11.0`.
- No em dashes anywhere (code, comments, docs). Grep for the character before each commit.
- Formatting is tooling's job: run `npm run lint:fix` before committing, then `npm run lint` must be clean. Never hand-format.
- Never cap prose width (no `max-width`, no `ch` measures on text).
- No Henry, no blog content, no blog photos in this repo. Demo copy is neutral sample text, impersonal and active in voice (the ui site's register, not Curt's blog voice).
- Comments must not name blog files (`Base.astro`, `henry-loose.ts`) or cite docs that do not exist in this repo.
- eslint forbids non-null assertions and `String.match` where `RegExp.exec` works; prefer code that needs no `eslint-disable`.
- Gates per task: `npm test` (root, runs css, astro, site workspaces) and `npm run lint`. Site-touching tasks also: `npm run build:site` then `BROWSER_TESTS=1 npm run test:browser` (needs Chrome; a leftover server on port 4327 must be killed first).
- Windows host: use Git Bash syntax in commands. Never `rm -rf` a path that may contain a `node_modules` junction.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

- Popout Tab handling with a note whose body holds no link (only the close button is focusable): Tab from the close button must close and move on, Shift+Tab must land on the trigger. Pinned in Task 3.
- Popout Tab-past-end when the trigger is the last focusable on the page: focus falls back to the trigger rather than escaping to browser chrome. Pinned in Task 3.
- focus-mode on a checkbox or button (not editable): Space or Enter still stamps keyboard, only text entry is exempt. Pinned in Task 6.
- Lightbox wheel with `deltaMode === 1` (Firefox line mode): one notch still zooms about one step, not a hair. Pinned in Task 4.
- Ecosystem cap with `limit` smaller than the self entry's rank and `limit === 1`: the list is exactly `[self]`. Pinned in Task 6.

---

### Task 1: css tokens and the values that mirror them

Covers CSS-1, CSS-2, CSS-3, CSS-6, CSS-7, CSS-8, CSS-9.

**Files:**
- Modify: `packages/css/src/tokens/theme-light.css` (`--focus-ring` line ~84, `--track-y` ~63, remove `--input-border` ~17)
- Modify: `packages/css/src/tokens/theme-dark.css` (remove `--input-border` ~21)
- Modify: `packages/css/src/tokens/primitives.css` (`--umber-500` ~83; remove `--ink-950`, `--ink-850`, `--ink-700`, `--parchment-dim`, `--stroke-1`, `--font-size-xxxl`, `--z-raised`; add `--z-panel: 18;` between `--z-scroll-top` and `--z-popout`; fix any comment that names a removed token)
- Modify: `packages/css/src/base/reset.css` (reduced-motion block ~67)
- Modify: `packages/astro/src/shiki/code-theme.mjs:29` and `packages/astro/src/shiki/code-vars.mjs:14` (`#8a7a63` to `#8e7e67`)
- Modify: `site/src/lib/derive-palette.ts` (any `#8a7a63` default), `site/test/derive-palette.test.ts` (anchor value line ~29 and the 4.3 assertion ~61-67)
- Modify: `site/src/styles/site.css:39-42` (use `--z-panel`)
- Modify: `packages/css/README.md` (ramp note on brand-2-500 and the track roles; z ladder if documented)
- Modify: `docs/superpowers/specs/2026-09-06-live-code-colors.md` (close the OPEN owner decision near line 169)
- Test: `packages/css/test/css-pins.test.ts`

**Interfaces:**
- Produces: token `--z-panel` (value 18). Removed tokens: `--input-border`, `--z-raised`, `--font-size-xxxl`, `--ink-950`, `--ink-850`, `--ink-700`, `--parchment-dim`, `--stroke-1`. Task 9 demos `--font-size-xs` through `--font-size-xxl`.

- [ ] **Step 1: Write the failing pins** in `packages/css/test/css-pins.test.ts`, inside the existing `describe`, using its `read()` helper:

```ts
  it("the light focus ring is the amber ink, which clears 3:1 on white", () => {
    expect(read("../src/tokens/theme-light.css")).toMatch(
      /--focus-ring: var\(--brand-1-700\);/,
    );
  });

  it("the light Y track is the teal ink, which clears 3:1 on white", () => {
    expect(read("../src/tokens/theme-light.css")).toMatch(
      /--track-y: var\(--brand-2-700\);/,
    );
  });

  it("the code comment ink clears 4.5:1 on the code ground", () => {
    expect(read("../src/tokens/primitives.css")).toMatch(
      /--umber-500: #8e7e67;/,
    );
  });

  it("the z ladder has a panel rung between scroll-top and popout", () => {
    const prims = read("../src/tokens/primitives.css");
    const z = (name: string): number => {
      const m = new RegExp(`--${name}: (\\d+);`).exec(prims);
      if (!m) throw new Error(`--${name} missing`);
      return Number(m[1]);
    };
    expect(z("z-panel")).toBeGreaterThan(z("z-scroll-top"));
    expect(z("z-panel")).toBeLessThan(z("z-popout"));
  });

  it("retired tokens are gone from every css file", () => {
    const retired = [
      "--input-border",
      "--z-raised",
      "--font-size-xxxl",
      "--ink-950",
      "--ink-850",
      "--ink-700",
      "--parchment-dim",
      "--stroke-1",
    ];
    const all = [
      "../src/tokens/primitives.css",
      "../src/tokens/theme-light.css",
      "../src/tokens/theme-dark.css",
    ]
      .map(read)
      .join("\n");
    for (const t of retired) expect(all, t).not.toContain(`${t}:`);
  });

  it("reduced motion turns smooth scrolling off", () => {
    const reset = read("../src/base/reset.css");
    const block = /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n {2}\}/.exec(reset);
    expect(block?.[0]).toMatch(/scroll-behavior: auto/);
  });
```

(If `read` resolves paths differently, match the existing tests' path style in that file.)

- [ ] **Step 2: Run and see them fail.** `npx vitest run --project packages/css` (or `npm test`). Expected: the six new tests FAIL.

- [ ] **Step 3: Make the token edits.**
  - theme-light: `--focus-ring: var(--brand-1-700);`, `--track-y: var(--brand-2-700);`, delete the `--input-border` line.
  - theme-dark: delete the `--input-border` line.
  - primitives: `--umber-500: #8e7e67;`; delete the seven retired primitives; replace `--z-raised: 1;` with nothing and add `--z-panel: 18;` after `--z-scroll-top: 17;` with a one-line comment: `/* Consumer fixed panels: over page floaters, under popouts and tips. */`. Update any comment in the file that lists a removed token.
  - reset.css: inside the existing `@media (prefers-reduced-motion: reduce)` block add

```css
    html {
      scroll-behavior: auto;
    }
```

- [ ] **Step 4: Mirror the comment ink.** In `packages/astro/src/shiki/code-theme.mjs` change `foreground: "#8a7a63"` to `"#8e7e67"`; in `code-vars.mjs` change the key `"#8a7a63"` to `"#8e7e67"`. Grep the whole repo (excluding node_modules, dist, docs/superpowers/reviews) for `8a7a63` and update every remaining live value (site `derive-palette.ts` default and its test anchor). In `site/test/derive-palette.test.ts` replace the "hand-tuned legacy at 4.38:1" comment and `toBeGreaterThanOrEqual(4.3)` with a plain `toBeGreaterThanOrEqual(4.5)` and a one-line comment `/* the shipped comment ink clears the same 4.5 gate (retuned 2026-09-27) */`.

- [ ] **Step 5: site.css.** Replace `z-index: calc(var(--z-scroll-top) + 1);` with `z-index: var(--z-panel);` and rewrite its comment to name the rung (`--z-panel keeps an open panel over every page floater and under popouts`).

- [ ] **Step 6: Docs.** In `packages/css/README.md` fix the ramp reasoning so it no longer says brand-2-500 is exempt because it is "not text": state that chart lines and focus rings need 3:1 (WCAG 1.4.11), so the light theme uses brand-1-700 for the focus ring and brand-2-700 for track-y, and brand-1-600 for track-x. If the README lists the z ladder or token table, add `--z-panel` and drop removed names. In `docs/superpowers/specs/2026-09-06-live-code-colors.md` change the "OPEN owner decision" paragraph's lead to `CLOSED 2026-09-27 (owner): retuned to #8e7e67, 4.63:1; the anchor test gates 4.5.` keeping the history sentence.

- [ ] **Step 7: Consumers of removed tokens.** Grep `packages/` and `site/` for every retired token name; there must be no `var(--...)` reference left. The site's ramp table parses primitives at build, so it updates itself.

- [ ] **Step 8: Gates.** `npm run lint:fix`, `npm run lint`, `npm test`, `npm run build:site`. All green.

- [ ] **Step 9: Commit** `fix(css): AA focus ring, comment ink and Y track; --z-panel; retire dead tokens` with a body listing CSS-1/2/3/6/7/8/9.

---

### Task 2: css Architecture section and the pointers to it

Covers CSS-4, CSS-5, TOOL-4.

**Files:**
- Read (source, do not modify): `../half-built-robots-blog/docs/css-architecture.md`
- Modify: `packages/css/README.md` (new `## Architecture` section)
- Modify: the nine headers citing `docs/css-architecture.md`: `packages/css/src/global.css`, `layers.css`, `tokens.css`, `base/reset.css`, `base/shell.css`, `code.css`, `patterns.css`, `prose.css`, `tokens/primitives.css`
- Modify: `packages/css/src/lightbox.css:2`, `plate-modal.css:2`, `path-player.css:1-2`, `prose.css:92` (dead spec paths)
- Modify: `packages/tooling/src/stylelintrc.json:8` (color-no-hex message)

- [ ] **Step 1: Read the blog doc** in full. Keep only design-system content: Layers, The visual grammar (patterns), The second accent, Keyboard focus, Themes, Tokens (primitives, roles, themes), Lint enforcement. Drop the Preface (step 11.4), Deferred, anything about blog files, Henry, WordPress, migration steps, or dates of blog work. Rewrite in the package's impersonal active register; describe the package as it is now (check each claim against the current css source: layer order in `layers.css`, the focus rule in `reset.css`, the current role names in theme files, the stylelint rules in `packages/tooling/src/stylelintrc.json`). The light focus ring is now `--brand-1-700` (Task 1).

- [ ] **Step 2: Write `## Architecture`** in `packages/css/README.md`, after `## Usage` and before `## Theming`, with `###` subsections: Layers, Patterns, The second accent, Keyboard focus, Themes, Tokens, Lint. No prose width caps apply (Markdown). No em dashes.

- [ ] **Step 3: Repoint the nine headers.** Replace each `docs/css-architecture.md` reference with `the @half-built/css README, Architecture` (keep each comment's own sentence otherwise). Verify: `grep -rn "css-architecture" packages site` returns nothing.

- [ ] **Step 4: Dead spec paths.** In lightbox.css, plate-modal.css, path-player.css and prose.css remove the parenthetical `docs/superpowers/specs/2026-07-30-...`, `2026-08-22-...`, `2026-08-14-...` references; keep each comment's rationale. The two live references (`primitives.css:42`, `popout.css:2`) stay. Verify every remaining `docs/superpowers/specs/` path in `packages/` exists.

- [ ] **Step 5: stylelint message.** Set it to `"Hex colors live in the token files only; use var(--...) (see the @half-built/css README, Architecture)"`.

- [ ] **Step 6: Gates** (`npm run lint:fix`, `npm run lint`, `npm test`), then **commit** `docs(css): Architecture section; repoint headers and the color-no-hex message`.

---

### Task 3: Popout keyboard exits, sheet drag-close, prop safety

Covers ISL-2, ISL-3 (popout half), ISL-12(a), CMP-2.

**Files:**
- Modify: `packages/astro/src/scripts/popout.ts`
- Modify: `packages/astro/src/components/Popout.astro`
- Modify: `packages/astro/README.md` (Popout: document-wide singleton note)
- Test: `packages/astro/test/popout-dom.test.ts`, `site/test/browser.test.ts` (the test at ~678 "the keyboard opens the popout, reaches its link, and leaves it")

**Interfaces:**
- Consumes: existing `finish(restore?: boolean)`, `current`, `mode`, `surface`, `closeBtn`, `doc` inside `mountPopouts`.
- Produces: exported pure helper `nextFocusableAfter(doc: Document, anchor: Element, skip: Element): HTMLElement | null` in `popout.ts` (exported for tests).

- [ ] **Step 1: Failing jsdom tests** in `popout-dom.test.ts` (reuse its FIXTURE, `byId`, `surface`, `stubPhone`, and the file's existing mount/handle pattern):

```ts
describe("nextFocusableAfter", () => {
  it("returns the first focusable after the anchor, skipping the given subtree", () => {
    document.body.innerHTML =
      '<button id="a">A</button><div id="skip"><a id="in" href="#">x</a></div>' +
      '<span>text</span><a id="b" href="#">B</a>';
    const got = nextFocusableAfter(document, byId("a"), byId("skip"));
    expect(got?.id).toBe("b");
  });

  it("returns null when nothing focusable follows", () => {
    document.body.innerHTML = '<button id="a">A</button><p>end</p>';
    expect(nextFocusableAfter(document, byId("a"), byId("a"))).toBeNull();
  });

  it("skips disabled, hidden and tabindex=-1 elements", () => {
    document.body.innerHTML =
      '<button id="a">A</button><button disabled>d</button>' +
      '<a href="#" tabindex="-1">n</a><input type="hidden"><a id="b" href="#">B</a>';
    expect(nextFocusableAfter(document, byId("a"), byId("a"))?.id).toBe("b");
  });
});
```

and, in the anchored-mode describe (stubPhone(false)):

```ts
  it("Shift+Tab from the close button closes the note and focuses the trigger", () => {
    byId("t1").click();
    const close = surface().querySelector<HTMLButtonElement>(".popout-close");
    close?.focus();
    close?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(surface().open).toBe(false);
    expect(document.activeElement?.id).toBe("t1");
  });

  it("Tab from the last link closes the note and focuses the next focusable after the trigger", () => {
    byId("t1").click();
    const inner = surface().querySelector<HTMLAnchorElement>(".popout-body a");
    inner?.focus();
    inner?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
    );
    expect(surface().open).toBe(false);
    expect(document.activeElement?.id).toBe("t2");
  });

  it("Tab from the close button of a link-less note moves on past the trigger", () => {
    byId("t2").click();
    const close = surface().querySelector<HTMLButtonElement>(".popout-close");
    close?.focus();
    close?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
    );
    expect(surface().open).toBe(false);
    expect(document.activeElement?.id).toBe("bare");
  });

  it("focus leaving the trigger for the page closes an open note", () => {
    byId("t1").click();
    byId("t1").focus();
    byId("t1").dispatchEvent(
      new FocusEvent("focusout", { relatedTarget: byId("outside"), bubbles: true }),
    );
    expect(surface().open).toBe(false);
  });
```

In the sheet describe (stubPhone(true)):

```ts
  it("a press that starts inside the sheet and ends on the backdrop does not close it", () => {
    byId("t1").click();
    const body = surface().querySelector(".popout-body");
    body?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    surface().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(surface().open).toBe(true);
  });

  it("a press and click both on the backdrop closes the sheet", () => {
    byId("t1").click();
    surface().dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    surface().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(surface().open).toBe(false);
  });
```

Note `#outside` is a `<p>`; give it `tabindex="0"` in FIXTURE if a focusable target is needed, and adjust existing tests only if that change affects them. Import `nextFocusableAfter`.

- [ ] **Step 2: Run** `npx vitest run packages/astro/test/popout-dom.test.ts`. Expected: new tests FAIL (helper not exported; notes stay open).

- [ ] **Step 3: Implement in `popout.ts`.**

```ts
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The first element after anchor, in document order, that sequential
    focus navigation would reach, ignoring anything inside skip. */
export function nextFocusableAfter(
  doc: Document,
  anchor: Element,
  skip: Element,
): HTMLElement | null {
  for (const node of doc.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (skip.contains(node) || anchor.contains(node)) continue;
    if (node.getAttribute("tabindex") === "-1") continue;
    if (node.closest("[hidden], [inert]")) continue;
    const after =
      anchor.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING;
    if (after) return node;
  }

  return null;
}
```

Inside `mountPopouts`, add a surface keydown handler, anchored mode only:

```ts
  /* Anchored only: the box sits last in <body>, so native Tab order
     would carry focus to the footer or out of the page. Shift+Tab off
     the first stop goes back to the trigger; Tab off the last stop
     goes to whatever follows the trigger. */
  const onSurfaceKey = (ev: KeyboardEvent): void => {
    if (ev.key !== "Tab" || !current || mode !== "anchored") return;
    const stops = [...surface.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = stops.at(0);
    const last = stops.at(-1);
    const active = doc.activeElement;

    if (ev.shiftKey && (active === surface || active === first)) {
      ev.preventDefault();
      finish();
      return;
    }

    if (!ev.shiftKey && (active === last || stops.length === 0)) {
      ev.preventDefault();
      const trigger = current;
      const next = nextFocusableAfter(doc, trigger, surface);
      finish(false);
      (next ?? trigger).focus();
    }
  };
```

Register `surface.addEventListener("keydown", onSurfaceKey)` beside the other surface listeners (the surface is removed on destroy, so no removal needed; follow the file's existing pattern for surface listeners).

Trigger focusout: add a document-level `focusout` listener that acts only when the event target is the current trigger:

```ts
  const onTriggerFocusOut = (ev: FocusEvent): void => {
    if (!current || mode !== "anchored" || ev.target !== current) return;
    if (ev.relatedTarget === null || inside(ev.relatedTarget)) return;
    finish(false);
  };
```

Add `doc.addEventListener("focusout", onTriggerFocusOut)` and remove it in `destroy()`. (Null `relatedTarget` from the trigger is a click or window switch; the existing pointer handlers and surface focusout own those.)

Sheet drag-close (ISL-3): add `let pressOnSurface = false;`; in `onPointerDown` set `pressOnSurface = ev.target === surface;` as its first line (before any early return). In `onClick` change the backdrop line to `if (ev.target === surface && mode === "sheet" && pressOnSurface) finish();` and reset `pressOnSurface = false` after it.

ISL-12(a): above `mountPopouts` add to the header comment: `A document-wide singleton, like link-tip: root only names the document; triggers anywhere in it open the one surface.`

- [ ] **Step 4: Run** the popout tests. Expected: PASS, including the old ones.

- [ ] **Step 5: CMP-2 in `Popout.astro`.**

```astro
---
import type { HTMLAttributes } from "astro/types";

type Owned =
  | "type"
  | "aria-haspopup"
  | "aria-expanded"
  | "aria-label"
  | "data-popout-label"
  | "class"
  | "class:list";

interface Props extends Omit<HTMLAttributes<"button">, Owned> {
  label: string;
  trigger?: string;
  class?: string;
}

const { label, trigger = "Note", class: className, ...rest } = Astro.props;
---

<button
  {...rest}
  type="button"
  class:list={["popout-trigger", className]}
  aria-haspopup="dialog"
  aria-expanded="false"
  aria-label={`${trigger}: ${label}`}
  data-popout-label={label}
>
  {trigger}
</button
><template class="popout-content"><slot /></template>
```

Keep the file's existing comments. Run `npx astro check` is not wired; instead confirm `npx tsc --noEmit -p packages/astro` stays clean and `npm run build:site` builds (the site passes `id` through, which must still type-check).

- [ ] **Step 6: Browser test.** In `site/test/browser.test.ts`, replace the tail of "the keyboard opens the popout, reaches its link, and leaves it" (the block commented "Shift+Tab out of the box (it sits last in <body>...") with:

```ts
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
        t && a && a !== document.body &&
          t.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING &&
          !a.closest("footer"),
      );
    });
    expect(landed).toBe(true);
```

(On open, focus is on the surface itself, so the first Shift+Tab is "from the surface".)

- [ ] **Step 7: README.** In the astro README's Popout section add one sentence: the island is a document-wide singleton; `root` only names the document.

- [ ] **Step 8: Gates:** `npm run lint:fix`, `npm run lint`, `npm test`, `npm run build:site`, `BROWSER_TESTS=1 npm run test:browser`. Commit `fix(popout): keyboard exits return to the table; sheet ignores drag-release; owned attributes win`.

---

### Task 4: plate-modal and lightbox

Covers ISL-3 (plate half), ISL-6, ISL-8 (lightbox), ISL-9, CMP-3.

**Files:**
- Modify: `packages/astro/src/scripts/plate-modal.ts` (~89-91), `packages/astro/src/scripts/lightbox.ts` (wheel ~479-487, open ~580-590, destroy ~626-629)
- Modify: `packages/astro/src/components/LightboxLink.astro`
- Test: `packages/astro/test/plate-modal-dom.test.ts`, `packages/astro/test/lightbox-dom.test.ts`, `packages/astro/test/lightbox-math.test.ts`

**Interfaces:**
- Produces: exported pure `wheelZoomFactor(deltaY: number, deltaMode: number, pageHeight: number): number` in `lightbox.ts` (returns 1 for `deltaY === 0`).

- [ ] **Step 1: Failing tests.**

`plate-modal-dom.test.ts` (follow its existing build/open idiom):

```ts
  it("a press inside the plate released on the veil does not close", () => {
    const pm = build();          // the file's existing builder helper
    pm.open(null);
    pm.plate.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    pm.dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(pm.dialog.open).toBe(true);
  });

  it("a press and click on the veil closes", () => {
    const pm = build();
    pm.open(null);
    pm.dialog.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    pm.dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(pm.dialog.open).toBe(false);
  });
```

`lightbox-math.test.ts` (or lightbox-dom if it holds the pure helpers):

```ts
describe("wheelZoomFactor", () => {
  it("a sideways swipe does not zoom", () => {
    expect(wheelZoomFactor(0, 0, 800)).toBe(1);
  });

  it("scrolling up zooms in and down zooms out, symmetrically", () => {
    const up = wheelZoomFactor(-100, 0, 800);
    const down = wheelZoomFactor(100, 0, 800);
    expect(up).toBeGreaterThan(1);
    expect(up * down).toBeCloseTo(1, 10);
  });

  it("one mouse notch is close to the old 1.2x step", () => {
    expect(wheelZoomFactor(-100, 0, 800)).toBeGreaterThan(1.15);
    expect(wheelZoomFactor(-100, 0, 800)).toBeLessThan(1.25);
  });

  it("forty small trackpad events add up to about one notch each 100px, not a jump to the clamp", () => {
    let f = 1;
    for (let i = 0; i < 40; i++) f *= wheelZoomFactor(-2.5, 0, 800);
    expect(f).toBeCloseTo(wheelZoomFactor(-100, 0, 800), 5);
  });

  it("line mode (Firefox) scales lines to pixels", () => {
    expect(wheelZoomFactor(-3, 1, 800)).toBeCloseTo(wheelZoomFactor(-48, 0, 800), 10);
  });

  it("page mode scales by the page height", () => {
    expect(wheelZoomFactor(-1, 2, 800)).toBeCloseTo(wheelZoomFactor(-800, 0, 800), 10);
  });
});
```

`lightbox-dom.test.ts`: add

```ts
  it("destroy while open clears the scroll lock", () => {
    // mount + open using the file's existing helpers
    expect(document.documentElement.classList.contains("pm-open")).toBe(true);
    handle.destroy();
    expect(document.documentElement.classList.contains("pm-open")).toBe(false);
  });

  it("a resize while open re-measures the box", () => {
    // mount + open; then change the viewbox size the test way the file already stubs getBoundingClientRect
    // dispatch window resize; press HOME (0) and assert the view fits the new box
  });
```

For the resize test, stub `getBoundingClientRect` on `.pm-viewbox` (or the file's equivalent) to return 800x600 at open, then 400x300, dispatch `new Event("resize")` on `window`, and assert the image's applied transform/scale equals the fit for 400x300 using the same assertion helper the existing "fit" tests use.

- [ ] **Step 2: Run** `npx vitest run packages/astro/test/plate-modal-dom.test.ts packages/astro/test/lightbox-math.test.ts packages/astro/test/lightbox-dom.test.ts`. Expected: new tests FAIL.

- [ ] **Step 3: plate-modal.** Track the press:

```ts
  /* A click targets the nearest common ancestor of press and release,
     so a drag from inside the plate that ends on the veil arrives here
     targeted at the dialog. Only a press that also began on the veil
     closes. */
  let pressOnVeil = false;
  dialog.addEventListener("pointerdown", (ev) => {
    pressOnVeil = ev.target === dialog;
  });
  dialog.addEventListener("click", (ev) => {
    if (ev.target === dialog && pressOnVeil) dialog.close();
    pressOnVeil = false;
  });
```

Keep the existing identity-check comment above it.

- [ ] **Step 4: lightbox wheel.**

```ts
/* One mouse notch (100px) is about the old fixed 1.2x step; a
   trackpad's many small deltas add up to the same total instead of
   stepping 1.2x each. deltaMode 1 is lines, 2 is pages. */
const WHEEL_K = Math.log(1.2) / 100;
const LINE_PX = 16;

export function wheelZoomFactor(
  deltaY: number,
  deltaMode: number,
  pageHeight: number,
): number {
  if (deltaY === 0) return 1;
  const px =
    deltaMode === 1 ? deltaY * LINE_PX : deltaMode === 2 ? deltaY * pageHeight : deltaY;
  return Math.exp(-px * WHEEL_K);
}
```

and in the wheel listener:

```ts
        ev.preventDefault();
        const factor = wheelZoomFactor(ev.deltaY, ev.deltaMode, boxH);
        if (factor === 1) return;
        const { cx, cy } = rel(ev);
        rezoom(factor, cx, cy);
```

- [ ] **Step 5: lightbox resize and destroy.** In `open`, after measuring, register a window resize listener that re-measures (`boxW/boxH` from `r.viewbox.getBoundingClientRect()` with the same fallbacks), sets `view = initialView(item().w, item().h, boxW, boxH)` and `applyView(r)`. Remove it on the dialog's `close` event (register the close cleanup once per open, or keep one named handler and add/remove it). In `destroy()`, before `refs.dialog.remove()`: `if (refs.dialog.open) refs.dialog.close();`.

- [ ] **Step 6: CMP-3 in `LightboxLink.astro`.**

```astro
---
import type { HTMLAttributes } from "astro/types";

type Owned =
  | "href"
  | "aria-label"
  | "data-lb-w"
  | "data-lb-h"
  | "data-lb-caption"
  | "class"
  | "class:list";

interface Props extends Omit<HTMLAttributes<"a">, Owned> {
  href: string;
  w: number;
  h: number;
  caption?: string;
  class?: string;
}

const { href, w, h, caption = "", class: className, ...rest } = Astro.props;
---

<a
  {...rest}
  class:list={["lightbox-link", className]}
  href={href}
  data-lb-w={w}
  data-lb-h={h}
  data-lb-caption={caption}
  aria-label={`View full-size image${caption ? `: ${caption}` : ""}`}
  ><slot
/></a>
```

Check every internal caller (`grep -rn "LightboxLink" packages/astro/src`) still type-checks: `npx tsc --noEmit -p packages/astro`.

- [ ] **Step 7: Gates** (lint:fix, lint, test, build:site). Commit `fix(lightbox): delta-scaled wheel zoom, refit on resize, destroy unlocks; veil closes only on a veil press`.

---

### Task 5: path player and frame loop

Covers ISL-1, ISL-8 (player), ISL-10, ISL-13.

**Files:**
- Modify: `packages/astro/src/scripts/path-player.ts` (~155-175 build, ~214 query, open/close)
- Modify: `packages/astro/src/scripts/core/frame-loop.ts`
- Test: `packages/astro/test/path-player-dom.test.ts`, `packages/astro/test/frame-loop.test.ts`, `packages/astro/test/breakpoints.test.ts`

- [ ] **Step 1: Failing tests.**

path-player-dom, in the existing "opens paused under prefers-reduced-motion" test (~132), add after its current expectations:

```ts
    const playBtn = document.querySelector(".pp-play");
    expect(playBtn?.querySelector("svg")).not.toBeNull();
    expect(playBtn?.getAttribute("aria-pressed")).toBe("false");
```

Add a no-stage case (config with `buildStage: () => false`, built with the file's existing config factory):

```ts
  it("with no stage the disabled play button still shows its glyph", () => {
    const player = createPathPlayer(document, { ...config(), buildStage: () => false });
    player.open(null);
    const playBtn = document.querySelector<HTMLButtonElement>(".pp-play");
    expect(playBtn?.disabled).toBe(true);
    expect(playBtn?.querySelector("svg")).not.toBeNull();
  });
```

Resize (ISL-8):

```ts
  it("a resize while open re-lays the timeline to its new width", () => {
    const player = createPathPlayer(document, config());
    player.open(null);
    const timeline = document.querySelector<HTMLElement>(".pp-timeline");
    const canvas = document.querySelector<HTMLCanvasElement>(".pp-tracks");
    if (!timeline || !canvas) throw new Error("no timeline");
    Object.defineProperty(timeline, "clientWidth", { configurable: true, value: 300 });
    window.dispatchEvent(new Event("resize"));
    expect(canvas.width).toBe(Math.floor(300 * (window.devicePixelRatio || 1)));
  });
```

(Adapt `dpr()` expectations to the file's own dpr source.)

frame-loop.test.ts (use its fake rAF pattern):

```ts
  it("stop then start inside the callback keeps a single chain", () => {
    // drive with the file's fake rAF; cb calls loop.stop(); loop.start() on its 2nd call
    // then advance several frames and assert cb ran once per frame (count equals frames advanced)
  });
```

Write it concretely against the helper the file already uses (e.g. `stubRafOnFakeTimers` + `vi.advanceTimersByTime(16 * n)`), asserting the call count after the restart grows by exactly one per 16 ms.

breakpoints.test.ts: add

```ts
  it("no system-breakpoint literal survives in the island scripts", () => {
    const dir = fileURLToPath(new URL("../src/scripts/", import.meta.url));
    const files = readdirSync(dir, { recursive: true })
      .map(String)
      .filter((f) => f.endsWith(".ts"));
    for (const f of files) {
      const t = readFileSync(join(dir, f), "utf8");
      expect(t, f).not.toMatch(/\((?:max|min)-width: *(?:768|769|991|1024)px\)/);
    }
  });
```

(import `readdirSync`, `readFileSync`, `join`, `fileURLToPath` as needed.)

- [ ] **Step 2: Run** the three files; the new tests FAIL (breakpoints fails on path-player.ts).

- [ ] **Step 3: Implement.**
  - Build: after `restartBtn.innerHTML = ICON_ROTATE_CCW;` add `playBtn.innerHTML = ICON_PLAY;` and `playBtn.setAttribute("aria-pressed", "false");`.
  - Query: `import { BP_PHONE_MAX } from "./core/breakpoints";` and `` mediaQuery.call(globalThis, `(max-width: ${BP_PHONE_MAX}px)`) ``.
  - Resize: `const onResize = (): void => { layoutTracks(); drawFrame(); };` added to `win` in `open` (after `layoutTracks()`), removed in the dialog `close` listener.
  - frame-loop: add `let gen = 0;`. `start()` does `gen++` before scheduling and the rAF callback captures it: `const mine = gen; handle = win.requestAnimationFrame((now) => tick(now, mine));`. `tick(now, mine)` returns early when `mine !== gen || !live`, and after `cb(dt)` reschedules only `if (live && mine === gen)`. `stop()` also does `gen++`. Update the header comment's reentrancy sentence to say stop, start, or both inside the callback keep one chain.

- [ ] **Step 4: Run** the files; PASS. **Gates**, then commit `fix(path-player): glyph on first paused open, relayout on resize, phone query from the token; frame-loop keeps one chain`.

---

### Task 6: focus-mode, theme toggle, code copy, ecosystem cap

Covers ISL-4, ISL-5, ISL-7, ISL-11, ISL-12(b)(c).

**Files:**
- Modify: `packages/astro/src/scripts/focus-mode.ts`, `theme-toggle.ts`, `code-island.ts`, `ecosystem.ts` (`sortEntries` ~69-89)
- Modify: `packages/astro/src/components/ThemeToggle.astro` (drop `aria-pressed="false"`)
- Test: `packages/astro/test/focus-mode-dom.test.ts`, `theme-toggle-dom.test.ts`, `code-island-dom.test.ts`, `ecosystem-dom.test.ts` (~138-140)

- [ ] **Step 1: Failing tests.**

focus-mode:

```ts
  it("typing in a clicked text field keeps the pointer stamp", () => {
    mount();
    document.body.innerHTML = '<input id="f" type="email">';
    const f = document.getElementById("f");
    f?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    f?.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(document.documentElement.dataset.focus).toBe("pointer");
  });

  it("Tab from a text field stamps keyboard", () => {
    mount();
    document.body.innerHTML = '<input id="f" type="text">';
    const f = document.getElementById("f");
    f?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    f?.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.documentElement.dataset.focus).toBe("keyboard");
  });

  it("Space on a checkbox stamps keyboard (only text entry is exempt)", () => {
    mount();
    document.body.innerHTML = '<input id="c" type="checkbox">';
    document.getElementById("c")?.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true }),
    );
    expect(document.documentElement.dataset.focus).toBe("keyboard");
  });

  it("mounting on a Document stamps its root element", () => {
    const h = mountFocusMode(document);
    handles.push(h);
    window.dispatchEvent(new PointerEvent("pointerdown"));
    expect(document.documentElement.dataset.focus).toBe("pointer");
  });
```

theme-toggle (use its fixture/mount helpers):

```ts
  it("carries an action label and no aria-pressed, in both themes", () => {
    // mount on a fixture with one .theme-toggle button
    const btn = document.querySelector(".theme-toggle");
    expect(btn?.hasAttribute("aria-pressed")).toBe(false);
    (btn as HTMLButtonElement).click();
    expect(btn?.hasAttribute("aria-pressed")).toBe(false);
    expect(btn?.getAttribute("aria-label")).toMatch(/Switch to/);
  });

  it("claims each button, and one mount's click keeps another mount's labels", () => {
    // fixture: two buttons #a and #b; mount root A over #a with labels {light:"LA",dark:"DA"},
    // mount root B over #b with labels {light:"LB",dark:"DB"}; click #a;
    // expect #a label DA-or-LA per new theme and #b label the B pair's entry for the same theme
    // expect #a.hasAttribute("data-island-theme-toggle") (the claim attribute the core uses)
  });
```

Write the second test concretely against the fixture shape the file uses; check `core/island.ts` for the exact claim attribute name.

code-island:

```ts
  it("announces the copy outcome through a status region", async () => {
    // mount on the file's fixture with clipboard.writeText resolving
    const status = document.querySelector('.code-island-bar [role="status"]');
    expect(status?.classList.contains("screen-reader-text")).toBe(true);
    (document.querySelector(".code-copy") as HTMLButtonElement).click();
    await Promise.resolve(); await Promise.resolve();
    expect(status?.textContent).toBe("COPIED");   // the default copied label
  });
```

and a failing-clipboard variant expecting the failed label.

ecosystem: change the existing "caps at the limit" expectation to include self, and add:

```ts
  it("the self entry survives a cap it would otherwise fall past", () => {
    const got = sortEntries(DOC.entries, "ui", 2)?.map((e) => e.key);
    expect(got).toHaveLength(2);
    expect(got).toContain("ui");
  });

  it("a cap of one is exactly the self entry", () => {
    expect(sortEntries(DOC.entries, "ui", 1)?.map((e) => e.key)).toEqual(["ui"]);
  });
```

Inspect `DOC` first: if `ui` already ranks inside the top 2, construct a local entries array where it does not.

- [ ] **Step 2: Run**; new tests FAIL.

- [ ] **Step 3: Implement.**

focus-mode:

```ts
/* Text entry is not navigation: a reader who clicked into a field and
   types keeps the click highlight. Tab always means keyboard. */
function isTextEntry(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) {
    return true;
  }
  if (!(t instanceof HTMLInputElement)) return false;
  return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file", "image"].includes(t.type);
}
```

`onKeydown = (ev: KeyboardEvent) => { if (ev.key !== "Tab" && isTextEntry(ev.target)) return; el.dataset.focus = "keyboard"; }`. Root resolution: `const el = root instanceof Document ? root.documentElement : (root as HTMLElement);`.

theme-toggle: drop the `aria-pressed` line from `reflect`; replace the module `Set` with `claim(btn, "theme-toggle")` per button (skip a button whose claim fails) and a per-button labels map: `const labelsOf = new WeakMap<HTMLButtonElement, Record<Theme, string>>();` set at mount. The click handler reflects every claimed button in the document (`doc.querySelectorAll<HTMLButtonElement>(selector)` filtered to those in `labelsOf`) with that button's own labels. `destroy()` removes listeners, deletes from `labelsOf`, and `release(btn, "theme-toggle")`. Remove `aria-pressed="false"` from `ThemeToggle.astro`. Update the header comment accordingly.

code-island: per bar create `const status = doc.createElement("span"); status.className = "screen-reader-text"; status.setAttribute("role", "status");` appended to the bar; `doCopy` sets `status.textContent` to the same text as the button; the reset timer sets it to `""`. Destroy already removes the bar.

ecosystem `sortEntries`: after sorting,

```ts
  const capped = sorted.slice(0, limit);
  if (limit > 0 && !capped.includes(self)) capped[capped.length - 1] = self;
  return capped;
```

and update the doc comment: the self entry always survives the cap, taking the last slot when it would fall past it.

- [ ] **Step 4: Run**; PASS. Grep `packages/astro/test` and `site/test` for `aria-pressed` expectations on the theme toggle and update them. **Gates** including `BROWSER_TESTS=1 npm run test:browser` (the site renders the toggle). Commit `fix(islands): text entry keeps the click ring, toggle drops aria-pressed and claims, copy result announced, self survives the ecosystem cap`.

---

### Task 7: astro docs, comments and the dead icon

Covers CMP-1 (README), CMP-4, CMP-5, ISL-14.

**Files:**
- Modify: `packages/astro/README.md` (Corner badges ~42-47; Ecosystem and Popout import examples)
- Modify: `packages/astro/src/scripts/core/icons.ts` (remove `ICON_SPARKLES`; fix line ~4 "to-top chevron in Base.astro")
- Modify: comments in `site-header.ts:27-30`, `path-player.ts` (~25, ~195, ~424 henry-loose references), `link-tip.ts:38`, `code-island.ts:6`, `lightbox.ts:4`
- Test: `packages/astro/test/icons.test.ts` if it enumerates exports

- [ ] **Step 1:** Corner badges paragraph: replace the "keep a `genai` boolean as authoring sugar" sentence with: content components (`BlogImage`, `GalleryImage`, `MediaText`) take the same `badges` array, for example `badges={[GENAI_BADGE]}` with `GENAI_BADGE` imported from `@half-built/astro/scripts/core/badges.ts`.
- [ ] **Step 2:** Import examples: `@half-built/astro/scripts/ecosystem.ts` and `@half-built/astro/scripts/popout.ts`. Also update the site's `popoutLayoutSample` string in `site/src/pages/index.astro` if it shows the extensionless form (it does: `@half-built/astro/scripts/popout`), so the demo matches the README.
- [ ] **Step 3:** Remove `ICON_SPARKLES` (grep packages, site; the blog has no importer). Run `npm test`; fix `icons.test.ts` if it lists exports.
- [ ] **Step 4:** Comment pass over `packages/astro/src/scripts/`: `grep -rn "Base.astro\|henry-loose\|11\.3" packages/astro/src/scripts`. Rewrite each hit to describe the package's own code (e.g. "the consumer's layout", "the same matchMedia widening used below") without naming blog files; the 11.3 decision is described as settled.
- [ ] **Step 5: Gates**, commit `docs(astro): badges README, extension-true imports, comment truth; drop ICON_SPARKLES`.

---

### Task 8: tooling package

Covers TOOL-1, TOOL-2, TOOL-3, TOOL-5, TOOL-6, TOOL-7, TOOL-9, TOOL-10, TOOL-11.

**Files:**
- Modify: `packages/tooling/src/test-kit/browser-server.ts`
- Modify: `packages/tooling/package.json`, root `package.json`, `package-lock.json` (via npm)
- Modify: `packages/tooling/src/eslint.config.mjs` (~130-143)
- Modify: `packages/tooling/README.md`
- Create: `packages/tooling/vitest.config.ts`, `packages/tooling/test/browser-server.test.ts`
- Modify: `vitest.workspace.ts` (add `"packages/tooling"`)

- [ ] **Step 1: Failing test** `packages/tooling/test/browser-server.test.ts` (node environment):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const spawned = { pid: 4242, exitCode: null as number | null };
const spawnSync = vi.fn();
const kill = vi.spyOn(process, "kill").mockImplementation(() => true);

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => spawned),
  spawnSync: (...args: unknown[]) => spawnSync(...args),
}));

describe("startPreview", () => {
  beforeEach(() => {
    process.env.CHROME_PATH = process.execPath; // any existing file satisfies findChrome
    spawnSync.mockClear();
    kill.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CHROME_PATH;
  });

  it("kills the spawned server when the ready path 404s", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls++;
      if (calls === 1) throw new Error("nothing on the port yet");
      return new Response("", { status: 404 });
    }));
    const { startPreview } = await import("../src/test-kit/browser-server");
    await expect(startPreview(4999, "/missing/")).rejects.toThrow(/404/);
    const killed =
      process.platform === "win32"
        ? spawnSync.mock.calls.some((c) => c[0] === "taskkill")
        : kill.mock.calls.some((c) => c[0] === -4242);
    expect(killed).toBe(true);
  });
});
```

`packages/tooling/vitest.config.ts`: copy `packages/astro/vitest.config.ts` (`include: ["test/**/*.test.ts"]`). Add `"packages/tooling"` to `vitest.workspace.ts`. Make sure the tooling package's `files` stays `["src"]` so tests do not ship.

- [ ] **Step 2: Run** `npx vitest run packages/tooling`. Expected: FAIL (no kill).

- [ ] **Step 3: TOOL-1.**

```ts
  try {
    await waitForServer(`${origin}${readyPath}`, server);
  } catch (err) {
    /* A server that is up but wrong (404) or slow past the wait is
       still running; the caller never receives it to stop, so stop it
       here or it holds the port for the next run. */
    stopPreview(server);
    throw err;
  }

  return server;
```

Run: PASS.

- [ ] **Step 4: Dependencies (TOOL-2, TOOL-3, TOOL-11, TOOL-7).** In `packages/tooling/package.json`: add `"postcss-html": "^2.0.0"` and `"stylelint-config-standard": "^40.0.0"` to `dependencies` (keep alphabetical order); add `peerDependenciesMeta` entries `"html-validate": { "optional": true }` and `"vitest": { "optional": true }` beside puppeteer-core; add `"engines": { "node": "^22.13.0 || >=24" }`. Remove `postcss-html` and `stylelint-config-standard` from the root `package.json` devDependencies. Run `npm install` at the root so the lockfile updates; confirm `node_modules/postcss-html` and `node_modules/stylelint-config-standard` still resolve and `npm run lint:css` still works. Check the release test (`site/test/release.test.ts`) and any manifest checks still pass.

- [ ] **Step 5: TOOL-5.** Add to `CHROME_CANDIDATES` after the Windows entries:

```ts
  /* macOS */
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
```

Update the file header comment's "search order is preserved verbatim" sentence (it no longer is).

- [ ] **Step 6: TOOL-9.** Run `npx eslint --print-config packages/astro/test/lib.test.ts` and on a `.astro` file's virtual `.ts` if feasible; confirm `no-undef` is off for typed `.ts`. Drop the `globals` blocks that only target `.ts` files under the strict type-checked tier; where an entry also serves `.js`/`.mjs`/`.astro`, narrow its `files` glob to those and keep it with a comment naming them. `npm run lint` must stay clean.

- [ ] **Step 7: README (TOOL-6, TOOL-10, TOOL-11, TOOL-7, TOOL-5).** Rewrite `## Test kit` to list every export with one line each: from `test-kit/browser-server.ts` `findChrome` (with `CHROME_PATH` override and the candidate platforms), `startPreview(port, readyPath)` (refuses a busy port; stops its own server on a failed wait), `stopPreview(server)`, `launchChrome`, `desktopPage`, `phonePage`; from `test-kit/helpers.ts` every export (read the file: `stubRafOnFakeTimers`, `polyfillDialog`, `recordingContext`, `CanvasCall`, `RecordingContext`, and any others). Add `## Requirements`: Node `^22.13.0 || >=24`; required peers eslint, stylelint, prettier; optional peers html-validate (the htmlvalidate preset), vitest and puppeteer-core (the test kit). Add to the prettier preset bullet: keep `astroCompressHTML` in step with Astro's `compressHTML` (default true); a consumer that turns compressHTML off must override `astroCompressHTML` too.

- [ ] **Step 8: Gates**, commit `fix(tooling): stop the preview on a failed wait; declare the stylelint deps; optional peers, engines, macOS Chrome, full test-kit docs`.

---

### Task 9: the demo site

Covers OPS-9, OPS-13, OPS-14, OPS-15 and the demo-coverage gaps.

**Files:**
- Create: `site/src/pages/2026/09/01/sample-published.astro`
- Create: `site/src/scripts/path-demo.ts`
- Modify: `site/src/pages/index.astro`, `site/src/data/site.ts:40-44`, `site/src/layouts/Base.astro` (only if the path demo mounts there), `site/src/styles/site.css` (specimen styles), `site/README.md`, `packages/astro/tsconfig.json`
- Test: `site/test/browser.test.ts`

- [ ] **Step 1: Browser tests first** (in the main describe, after the existing popout tests; reuse `open()`, `settleFrames`, `runAxe`, `report`):

```ts
  it("the PostLink demo's resolved link lands on a real page", async () => {
    const p = await open();
    const href = await p.$eval("#components a[href$='/sample-published/']", (a) => a.getAttribute("href"));
    const res = await p.goto(`${ORIGIN}${href ?? ""}`, { waitUntil: "networkidle0" });
    expect(res?.status()).toBe(200);
    expect(await p.$eval("h1", (h) => h.textContent)).toMatch(/sample post/i);
  });

  it("the type scale specimen shows every size stop", async () => {
    const p = await open();
    const names = await p.$$eval(".type-scale [data-size]", (els) => els.map((e) => e.getAttribute("data-size")));
    expect(names).toEqual(["xs", "sm", "base", "md", "lg", "xl", "xxl"]);
    const sizes = await p.$$eval(".type-scale [data-size]", (els) =>
      els.map((e) => parseFloat(getComputedStyle(e).fontSize)),
    );
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
  });

  it("the blog image demo wears the AI Art badge", async () => {
    const p = await open();
    expect(await p.$("#components .blog-image .badge-genai")).not.toBeNull();
  });

  it("the path player opens with a glyph in its play button and paints both tracks", async () => {
    const p = await open();
    await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await p.click("#demo-path-player");
    await settleFrames(p);
    expect(await p.$(".pp-plate .pp-play svg")).not.toBeNull();
    expect(await p.$eval(".pp-tracks", (c) => (c as HTMLCanvasElement).width)).toBeGreaterThan(0);
    const violations = await runAxe(p);
    expect(violations, report("light, path player open", violations)).toEqual([]);
  });

  it("typing in a clicked joined field keeps the pointer stamp", async () => {
    const p = await open();
    await p.click(".field-join-input");
    await p.keyboard.type("a");
    expect(await p.evaluate(() => document.documentElement.dataset.focus)).toBe("pointer");
  });
```

Run `npm run build:site && BROWSER_TESTS=1 npm run test:browser`; the new tests FAIL.

- [ ] **Step 2: Stub page.** `site/src/pages/2026/09/01/sample-published.astro` using `Base` like index (read `Base.astro` props): `<article class="static-page bracket-frame"><h1>The sample post</h1><div class="prose"><p>This page stands in for the published sample post that the PostLink demo resolves to. <a href="/#components">Back to the components</a>.</p></div></article>`, with `title="The sample post"` and a one-line description. Check the sitemap integration still builds.

- [ ] **Step 3: Socials** (`site/src/data/site.ts`): the second entry becomes `{ label: "Packages on npm", href: "https://www.npmjs.com/org/half-built", icon: ICON_EXTERNAL }`.

- [ ] **Step 4: Type scale specimen.** In index.astro's CSS section, after the Tokens `<h3>` block, add:

```astro
        <h3>Type scale</h3>
        <div class="prose">
          <p>
            The fluid size stops. Each line renders at its own token and
            names it.
          </p>
          <ul class="type-scale">
            {["xs", "sm", "base", "md", "lg", "xl", "xxl"].map((s) => (
              <li data-size={s} style={`font-size: var(--font-size-${s})`}>
                <code>--font-size-{s}</code> Sample text
              </li>
            ))}
          </ul>
        </div>
```

with `.type-scale { list-style: none; padding: 0; }` and `.type-scale li { margin: 0 0 0.25em; }` in site.css (no width caps). If an inline `style` trips the site's lint or CSP rules, use one class per size in site.css instead.

- [ ] **Step 5: BlogImage badge.** Give the existing BlogImage demo `badges={[GENAI_BADGE]}` and set its caption to say it carries the AI Art badge. Update the Components intro sentence if it enumerates.

- [ ] **Step 6: TwoColumn.** Read `packages/astro/src/components/TwoColumn.astro` for its slots and props. In the Frame section add `<h3>Two-column layout</h3>` with a short sentence and a framed example (a bordered box) holding `<TwoColumn>` with a main slot of two placeholder paragraphs and its sidebar slot holding a `LinkListWidget` of `linkListItems`. Add its import to `frameImports`.

- [ ] **Step 7: ExcerptStart.** In the frontmatter:

```ts
import { deriveExcerpt } from "@half-built/astro/lib/excerpt.ts";

const excerptSampleBody = `A short aside that opens the sample post and should stay off the card.

<ExcerptStart />

The card text starts here, after the marker, and runs until the excerpt limit cuts it at a word boundary with an ellipsis.`;

const excerptCard: PostCardModel = {
  href: "#",
  title: "Sample post, excerpt after a marker",
  excerpt: deriveExcerpt(excerptSampleBody) ?? "",
  author: "Demo Author",
  dateStr: "4, Jan 2026",
  minutes: 2,
  hero: placeholderWide,
  categories: [{ name: "Sample", href: "#" }],
};
```

Render it as a fourth card in the Post cards grid (or right after, with a `<Code>` block showing `excerptSampleBody`) and a sentence in the Cards intro: the fourth card's text starts after an `ExcerptStart` marker, skipping the aside above it. Confirm the built card text begins "The card text starts here".

- [ ] **Step 8: Path player demo.** `site/src/scripts/path-demo.ts`:

```ts
import { createPathPlayer } from "@half-built/astro/scripts/path-player.ts";

interface Point { x: number; y: number }

const N = 240;
const DURATION = 8;
const samples: Point[] = Array.from({ length: N }, (_, i) => {
  const t = (i / N) * Math.PI * 2;
  return { x: Math.sin(3 * t), y: Math.sin(2 * t) };
});

/* A neutral stand-in for a real stage: a point tracing a Lissajous
   curve on a 2D canvas, so the transport, tracks and caption can be
   seen without any site-specific renderer. */
export function mountPathDemo(doc: Document): void {
  const btn = doc.getElementById("demo-path-player");
  if (!btn) return;
  let ctx: CanvasRenderingContext2D | null = null;
  let canvas: HTMLCanvasElement | null = null;

  const draw = (s: Point): void => {
    if (!ctx || !canvas) return;
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = getComputedStyle(canvas).getPropertyValue("--accent-1").trim() || "currentColor";
    ctx.beginPath();
    ctx.arc(w / 2 + s.x * w * 0.4, h / 2 + s.y * h * 0.4, 8, 0, Math.PI * 2);
    ctx.fill();
  };

  const player = createPathPlayer<Point>(doc, {
    title: "Sample path",
    source: "Generated sample",
    caption: "A point tracing a closed curve. The tracks below plot its X and Y over one loop.",
    duration: DURATION,
    samples,
    tracks: [
      {
        kind: "lines",
        height: 60,
        label: "PATH",
        series: [
          { label: "X", values: samples.map((s) => s.x), cssVar: "--track-x" },
          { label: "Y", values: samples.map((s) => s.y), cssVar: "--track-y" },
        ],
        regions: [],
        ticks: [],
      },
    ],
    buildStage: (viewbox) => {
      canvas = doc.createElement("canvas");
      canvas.className = "path-demo-stage";
      canvas.width = 640;
      canvas.height = 360;
      viewbox.append(canvas);
      ctx = canvas.getContext("2d");
      return ctx !== null;
    },
    sink: { start: draw, move: draw, stop: () => undefined },
  });

  btn.addEventListener("click", () => {
    player.open(btn);
  });
}
```

Before writing, read `path-player-paint.ts` and the `LinesTrack` type for the value range `paintLines` expects (normalize samples to it if it expects 0..1) and read `path-player.css` for the class the viewbox child needs (size the canvas to fill it with CSS in site.css: `.path-demo-stage { width: 100%; height: 100%; display: block; }`). In index.astro add a `<h3>Path player</h3>` subsection in Components with one sentence and `<button type="button" class="press-box" id="demo-path-player">Open the path player</button>` (match the house button class the page uses elsewhere, e.g. the `Button` component), import `@half-built/css/plate-modal.css` and `@half-built/css/path-player.css` where the site imports island CSS, and mount with `mountPathDemo(document)` in `Base.astro`'s module script next to the other mounts.

- [ ] **Step 9: Docs and config (OPS-9, OPS-15).** `site/README.md`: the opening sentence names all three packages (`@half-built/css`, `@half-built/astro`, `@half-built/tooling`); replace the "Ordering:" bullet with: the lockfile links the workspace packages, so Pages builds the site from the workspace source; the site's `@half-built/*` pins must equal the package version. Soften "if `site` builds, the packages work the way an external consumer would use them" to say it proves the packages' source and exports, not the packed tarballs. `packages/astro/tsconfig.json`: remove `"vitest.browser.config.ts"`.

- [ ] **Step 10: Run all gates**: `npm run lint:fix`, `npm run lint`, `npm test`, `npm run build:site`, `BROWSER_TESTS=1 npm run test:browser` (all including the existing a11y cases in both themes). Commit `feat(site): demo the type scale, content badges, TwoColumn, ExcerptStart and the path player; stub sample post; npm link`.

---

### Task 10: batch close-out

**Files:**
- Modify: `docs/superpowers/reviews/2026-09-27-code-audit.md` (status line and a "Fixed in 0.11.0" list)

- [ ] **Step 1:** Full gates from a clean tree: `npm test`, `npm run lint`, `npm run build:site`, `BROWSER_TESTS=1 npm run test:browser`. Grep for em dashes in changed files: `git diff --name-only 27ff104 | xargs grep -l "—"` must print nothing.
- [ ] **Step 2:** Update the audit doc's status line to `batch 2 (package fixes) landed on dev <date>; pipeline, test gaps remain` and add a short "Fixed on dev for 0.11.0" list of IDs with commit hashes.
- [ ] **Step 3:** Commit `docs: audit status after the 0.11.0 package fixes`.
