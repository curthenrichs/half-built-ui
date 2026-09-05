# Reference Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the private kitchen-sink page into the public reference site for ui.half-built-robots.com, with a brand-ramp primitive rename (0.2.0) and a live palette editor that emits copyable overrides.

**Architecture:** Phase 0 renames the six accent primitives to hue-neutral `--brand-*` ramps inside @half-built/css (values unchanged) and stages 0.2.0 versions. The site then restructures into anchored sections with a sticky TOC, and gains a fixed toolbar hosting a palette editor: two color pickers whose four dependent stops are derived in OKLCH to hard contrast thresholds, applied live via inline custom properties, persisted in localStorage, and exported as a copyable `:root` block.

**Tech Stack:** Astro 5 static site (npm workspaces), culori for OKLCH conversion, vitest at the repo root, puppeteer-core + @axe-core/puppeteer through @half-built/tooling's test-kit for the browser suite.

**Spec:** `docs/superpowers/specs/2026-09-05-reference-site-design.md`

## Global Constraints

- No em dashes anywhere: code, comments, docs, page copy.
- Reader-facing page copy is Curt's voice: no colon-joined clauses in prose, no rule-of-three lists, no marketing language; unknown rationale gets a `< Curt fill in: ... >` marker, never an invention.
- Never cap prose width: no `max-width`/`ch` measures on text containers.
- Every site import of package code uses a package specifier (`@half-built/...`), never a relative path into `packages/*/src`. Wildcard subpaths need explicit `.ts`/`.astro` extensions.
- Henry appears nowhere in this repo.
- The rename changes names only: all six hex values stay byte-identical (`#ffaa3c`, `#d98a1f`, `#a36300`, `#8ee6f2`, `#3cc7dd`, `#1a7f90`).
- `npx eslint .` stays clean (no non-null assertions, RegExp.exec over String.match). `npm test` (root vitest) and `npm run build:site` stay green after every task.
- No pushes to any remote, no tags, no publishes. Everything lands as local commits on `dev`.
- Comments state constraints the code cannot show; update any comment a rename makes untrue.

---

### Task 1: Brand-ramp rename and 0.2.0 staging

**Files:**
- Modify: `packages/css/src/tokens/primitives.css`
- Modify: `packages/css/src/tokens/theme-light.css`
- Modify: `packages/css/src/tokens/theme-dark.css`
- Modify: `packages/css/package.json`, `packages/astro/package.json`, `packages/tooling/package.json` (version `0.2.0`)
- Modify: `site/package.json` (deps `@half-built/astro` and `@half-built/css` to exact `0.2.0`)
- Modify: `packages/css/README.md`, `packages/astro/README.md` (any old primitive names in prose)
- Modify: `package-lock.json` (via `npm install`)

**Interfaces:**
- Produces: the six custom properties `--brand-1-500`, `--brand-1-600`, `--brand-1-700`, `--brand-2-300`, `--brand-2-500`, `--brand-2-700`, which Tasks 3 and 5 consume by exact name.

- [ ] **Step 1: Rename in primitives.css.** Replace the declarations only, values byte-identical:

```css
    /* Brand ramps, the entire third-party theming surface. Family 1 is
       the ecosystem amber by default, family 2 its cyan complement; the
       names are hue-neutral because a consumer may override all six
       (spec: docs/superpowers/specs/2026-09-05-reference-site-design.md).
       500 is the base, 700 its AA text ink on the light paper, 600 the
       chart kin, 300 the light kin legible as text on the dark ground. */
    --brand-1-500: #ffaa3c;
    --brand-1-600: #d98a1f;
    --brand-1-700: #a36300;
    --brand-2-300: #8ee6f2;
    --brand-2-500: #3cc7dd;
    --brand-2-700: #1a7f90;
```

The existing comment block above `--amber-500` (the amber-700 retuning story, the cyan family note) is history worth keeping: fold its facts into the block above, keeping the `#b5680c` BEADZ lesson sentence. Delete the old `--amber-*`, `--cyan-*`, `--ochre-600` lines. `--red-*` and `--violet-*` keep their names (fixed system colors, not the theming surface).

- [ ] **Step 2: Update both theme files.** Replace every `var(--amber-500)` with `var(--brand-1-500)`, `var(--amber-700)` → `var(--brand-1-700)`, `var(--ochre-600)` → `var(--brand-1-600)`, `var(--cyan-300)` → `var(--brand-2-300)`, `var(--cyan-500)` → `var(--brand-2-500)`, `var(--cyan-700)` → `var(--brand-2-700)`. Then read every comment in both files and update the ones the rename makes untrue (many say "amber" or "cyan" while describing the default hue, which stays true; only rewrite where a comment names a variable).

- [ ] **Step 3: Grep gates.** From the repo root, all three must hold:

```bash
grep -rn -- "--amber\|--cyan-\|--ochre" packages site/src   # no hits
grep -c -- "--brand-1-500" packages/css/src/tokens/primitives.css   # 1
git diff | grep "^[+-].*#" | sort | uniq -c   # every removed hex line has a matching added line (names differ, values identical)
```

- [ ] **Step 4: Version bumps.** Set `"version": "0.2.0"` in all three package manifests; in `site/package.json` set both @half-built deps to `"0.2.0"`. Run `npm install` at the repo root so the lockfile and workspace links update.

- [ ] **Step 5: Verify.** `npm test`, `npm run build:site`, `npx eslint .` all green. Open `site/dist/index.html` and confirm `--brand-1-500:#ffaa3c` (possibly minified) appears in the built css and `--amber` does not.

- [ ] **Step 6: Sweep prose.** Grep `README.md` files under `packages/` for `amber-500|amber-700|cyan-300|cyan-500|cyan-700|ochre` and update to the new names where they name variables.

- [ ] **Step 7: Commit** `feat!: rename accent primitives to brand ramps; stage 0.2.0`.

### Task 2: Contrast math and ground constants

**Files:**
- Create: `site/src/lib/contrast.ts`
- Create: `site/src/lib/grounds.ts`
- Test: `site/test/contrast.test.ts`

**Interfaces:**
- Produces: `relativeLuminance(hex: string): number`, `contrastRatio(a: string, b: string): number`, `LIGHT_PAPER = "#ffffff"`, `DARK_GROUND = "#111111"`. Task 3 consumes all four.

- [ ] **Step 1: Write the failing test** at `site/test/contrast.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { contrastRatio } from "../src/lib/contrast";
import { LIGHT_PAPER, DARK_GROUND } from "../src/lib/grounds";

describe("contrastRatio", () => {
  it("matches WCAG reference values", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    /* the a11y lesson this system was tuned around */
    expect(contrastRatio("#a36300", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#b5680c", "#ffffff")).toBeLessThan(4.5);
  });
});

describe("grounds", () => {
  it("match the installed css package's surface values", () => {
    const require = createRequire(import.meta.url);
    const pkgRoot = dirname(require.resolve("@half-built/css/package.json"));
    const primitives = readFileSync(join(pkgRoot, "src/tokens/primitives.css"), "utf8");
    const light = readFileSync(join(pkgRoot, "src/tokens/theme-light.css"), "utf8");
    const dark = readFileSync(join(pkgRoot, "src/tokens/theme-dark.css"), "utf8");
    expect(light).toMatch(/--surface:\s*var\(--white\)/);
    expect(dark).toMatch(/--surface:\s*var\(--black-900\)/);
    expect(primitives).toContain(`--white: ${LIGHT_PAPER}`);
    expect(primitives).toContain(`--black-900: ${DARK_GROUND}`);
  });
});
```

- [ ] **Step 2: Run it, expect failure** (modules missing): `npm test -- site/test/contrast.test.ts`.

- [ ] **Step 3: Implement.** `contrast.ts`:

```ts
/* WCAG 2.x relative luminance and contrast ratio over 6-digit hex. */
function channel(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`expected #rrggbb, got ${hex}`);
  const n = parseInt(m[1], 16);
  return (
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff)
  );
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
```

`grounds.ts`:

```ts
/* The two grounds derivation targets. Constants, not runtime reads,
   because only the active theme's values are computed in the browser;
   contrast.test.ts asserts they match the installed package, so they
   cannot go stale silently. */
export const LIGHT_PAPER = "#ffffff";
export const DARK_GROUND = "#111111";
```

- [ ] **Step 4: Run tests, expect pass.** Also `npx eslint .`.
- [ ] **Step 5: Commit** `feat(site): WCAG contrast math and test-pinned ground constants`.

### Task 3: derivePalette

**Files:**
- Create: `site/src/lib/derive-palette.ts`
- Modify: `site/package.json` (add dependency `culori@^4`), root `npm install`
- Test: `site/test/derive-palette.test.ts`

**Interfaces:**
- Consumes: `contrastRatio`, `LIGHT_PAPER`, `DARK_GROUND` from Task 2.
- Produces:

```ts
export interface PaletteOverride {
  "--brand-1-500": string; "--brand-1-600": string; "--brand-1-700": string;
  "--brand-2-300": string; "--brand-2-500": string; "--brand-2-700": string;
}
export interface BaseReadout {
  darkTextRatio: number;   /* base as text on DARK_GROUND */
  darkTextPasses: boolean; /* >= 4.5 */
  lightFillRatio: number;  /* base as line or fill on LIGHT_PAPER */
  lightFillPasses: boolean; /* >= 3 */
}
export function derivePalette(base1: string, base2: string): PaletteOverride;
export function readBases(base1: string, base2: string): { base1: BaseReadout; base2: BaseReadout };
export function overrideBlock(p: PaletteOverride): string; /* the copyable :root css text */
```

- [ ] **Step 1: Write the failing test.** Cases, all asserting via `contrastRatio` (never hardcoded hexes except inputs):
  - Regression anchor: `derivePalette("#ffaa3c", "#3cc7dd")` yields `--brand-1-700` and `--brand-2-700` at >= 4.5 on `LIGHT_PAPER`, `--brand-2-300` at >= 4.5 on `DARK_GROUND`, `--brand-1-600` at >= 3 on `LIGHT_PAPER`; the two 500 stops echo the inputs.
  - Greens: `derivePalette("#2f9e44", "#0ca678")` clears the same thresholds.
  - Pathological: near-white bases (`#fefefe`, `#f0f0ff`) and near-black (`#050505`) still return values clearing every threshold and matching `/^#[0-9a-f]{6}$/`.
  - Determinism: two calls with equal inputs return deeply equal results.
  - `readBases("#ffaa3c", "#3cc7dd")`: both `darkTextPasses` true; `readBases("#104020", "#0a2a40").base1.darkTextPasses` false.
  - `overrideBlock` output contains all six property names once each, in ramp order, and parses as css (assert with a regex per line; no css parser dependency).
- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement** with culori:

```ts
import { converter, clampChroma, formatHex } from "culori";
import { contrastRatio } from "./contrast";
import { LIGHT_PAPER, DARK_GROUND } from "./grounds";

const toOklch = converter("oklch");

/* Walk lightness in OKLCH, hue held, chroma clamped into gamut per
   step, until the candidate clears `passes`. Extremes are the
   backstop: pure black or white always clears these thresholds
   against the opposite ground. */
function walk(hex: string, dir: -1 | 1, passes: (c: string) => boolean): string {
  const start = toOklch(hex);
  if (start === undefined) throw new Error(`unparseable color ${hex}`);
  for (let l = start.l; l >= 0 && l <= 1; l += dir * 0.005) {
    const hexAtL = formatHex(clampChroma({ ...start, l }, "oklch"));
    if (passes(hexAtL)) return hexAtL;
  }
  return dir === -1 ? "#000000" : "#ffffff";
}
```

`derivePalette` returns the two bases normalized through `formatHex` plus: `--brand-1-700` = walk(base1, -1, c => contrastRatio(c, LIGHT_PAPER) >= 4.5); `--brand-2-700` likewise from base2; `--brand-2-300` = walk(base2, +1, c => contrastRatio(c, DARK_GROUND) >= 4.5); `--brand-1-600` = walk(base1, -1, c => contrastRatio(c, LIGHT_PAPER) >= 3). `readBases` computes the two readouts directly from `contrastRatio`. `overrideBlock` emits exactly the spec's block shape with the generated-at comment line.

- [ ] **Step 4: Run tests + eslint, expect green.**
- [ ] **Step 5: Commit** `feat(site): palette derivation in oklch with contrast-gated stops`.

### Task 4: Sections, TOC, and site identity

**Files:**
- Create: `site/src/data/sections.ts`
- Create: `site/src/components/Toc.astro`
- Create: `site/src/scripts/toc.ts`
- Create: `site/src/styles/site.css`
- Modify: `site/src/pages/index.astro`, `site/src/layouts/Base.astro`, `site/src/data/site.ts`

**Interfaces:**
- Produces: `SECTIONS: { id: string; title: string }[]` in sections.ts; `<section id={id}>` per entry on the page; `mountToc(root: Document): void`. Task 5 adds its own toolbar beside the TOC; Task 6 writes into the section intro slots; Task 7's tests select `section[id]` and the TOC nav.

- [ ] **Step 1: sections.ts** with exactly: `intro` (About), `chrome` (Chrome), `cards` (Cards), `navigation` (Navigation), `widgets` (Widgets), `content` (Content blocks), `css` (CSS primitives).
- [ ] **Step 2: Restructure index.astro.** Reorganize the existing rendered blocks (do not rewrite their sample data) under `<section id=...>` headings mapped: Masthead/Footer/ThemeToggle demos → chrome; PostCard variants + CategoryCard → cards; Pagination + PostNavigation → navigation; Widget + LinkListWidget + Subscribe → widgets; Button, Callout, Quote, Step, Walkthrough, Gallery, GalleryImage, BlogImage, MediaText, CodeBlock, Palette, Group, Spacer → content; token swatches/prose/patterns demos → css. Each section heading is followed by an empty `<div class="section-intro" data-section-intro={id}>` placeholder (Task 6 fills them) and a one-line `<code>` import specifier for the section's main component(s). The intro section holds the page lede (Task 6) and the three npm package links.
- [ ] **Step 3: Toc.astro + toc.ts.** An `<aside class="site-toc"><nav aria-label="Sections">` with one anchor per SECTIONS entry. `mountToc` uses one IntersectionObserver over `section[id]`, setting `aria-current="true"` on the link whose section is most recently intersecting (rootMargin `-40% 0px -55% 0px`, take the last entry with `isIntersecting`). Mounted from Base.astro's script block.
- [ ] **Step 4: site.css.** Imported by Base.astro after the package css. Layout: on wide viewports a two-column grid (TOC column sized to its content, main column takes the rest); `.site-toc { position: sticky; top: 1rem; align-self: start; }`; below the package's tablet breakpoint the TOC is not rendered sticky and collapses to a plain in-flow list at the top. No width caps on any prose container. Use the package's custom media via the existing postcss setup.
- [ ] **Step 5: Identity.** In site.ts set SITE_NAME "half-built ui", TAGLINE describing the reference site plainly, description meta in Base.astro's default to match, `<title>` "half-built ui". Leave NAV/SOCIALS/ECOSYSTEM as they are unless they name "kitchen sink"; the kitchen-sink phrase survives only where it describes the everything-on-one-page nature.
- [ ] **Step 6: Verify.** `npm run build:site` green; `npm test` green; eslint clean. Dev-server spot check that anchors land on their sections.
- [ ] **Step 7: Commit** `feat(site): sectioned page with sticky scroll-spy toc and public identity`.

### Task 5: Toolbar and palette editor island

**Files:**
- Create: `site/src/components/Toolbar.astro`
- Create: `site/src/scripts/palette-editor.ts`
- Create: `site/src/lib/palette-key.ts` (`export const PALETTE_STORAGE_KEY = "hbui-palette";`)
- Modify: `site/src/layouts/Base.astro` (render Toolbar, mount island), `site/src/styles/site.css`
- Test: `site/test/palette-editor.test.ts` (jsdom)

**Interfaces:**
- Consumes: `derivePalette`, `readBases`, `overrideBlock` (Task 3), `PALETTE_STORAGE_KEY`.
- Produces: `mountPaletteEditor(root: Document, opts: { storageKey: string }): void` and the DOM contract below, which Task 7's browser smoke selects.

- [ ] **Step 1: Markup contract** in Toolbar.astro, a fixed bottom-right `<aside class="site-toolbar">` wrapping a `<details data-palette-editor>` whose `<summary>` reads "Palette". Inside: two `<input type="color">` with `data-palette-base="1"` and `"2"` and visible labels "Accent 1" / "Accent 2"; preset buttons `data-palette-preset` with `data-base-1`/`data-base-2` attrs: Amber and cyan `#ffaa3c`/`#3cc7dd`, Portfolio blues `#1890ff`/`#13c2c2`, Greens `#2f9e44`/`#0ca678`; a readout list `<ul data-palette-readouts>`; a `<pre data-palette-css>` showing the current override block; buttons `data-palette-copy` ("Copy CSS") and `data-palette-reset` ("Reset"). The day/night toggle stays in the site header; the toolbar is palette only.
- [ ] **Step 2: Failing jsdom test.** Mount into a document containing the contract markup; assert: picking a base via input event sets all six properties on `documentElement.style` and writes `{"b1":...,"b2":...}` JSON to storage; a preset click routes through the same path; reset removes all six properties and the storage key; the `<pre>` text equals `overrideBlock(derivePalette(b1,b2))`; readouts contain a warning item when a base fails `darkTextPasses`; a fresh mount with storage populated re-applies the palette. Stub `navigator.clipboard.writeText` and assert copy sends the `<pre>` text.
- [ ] **Step 3: Implement palette-editor.ts.** Pure DOM + the Task 3 functions; state is only `{ b1, b2 }`. `apply()` derives, sets the six properties inline on `document.documentElement`, renders readouts (ratio to two decimals, pass mark or the warning sentence "Too dark to read as text on the dark theme, consider a lighter shade" / light-fill equivalent), rewrites the `<pre>`, persists. Reset clears storage, removes the six properties, resets the inputs to the amber preset values without applying overrides. Guard every storage read/write in try/catch. Copy uses `navigator.clipboard.writeText(pre.textContent ?? "")` with a small "copied" confirmation toggling on the button label.
- [ ] **Step 4: Styles.** `.site-toolbar { position: fixed; right: 1rem; bottom: 1rem; z-index: <one above the package's scroll-top island; read its value and go one higher>; }` panel surface uses the theme tokens (`var(--surface)` etc.), never literals. Must not overlap the scroll-top button: offset the toolbar leftwards of it. Content-sized panel (a control cluster, not prose, so sizing to content is fine).
- [ ] **Step 5: Wire Base.astro** (render `<Toolbar />` before the footer slot content, mount `mountPaletteEditor(document, { storageKey: PALETTE_STORAGE_KEY })` in the script block).
- [ ] **Step 6: Run tests + eslint + build, expect green.**
- [ ] **Step 7: Commit** `feat(site): palette editor toolbar with live override and copyable css`.

### Task 6: What-and-why prose

**Files:**
- Modify: `site/src/pages/index.astro` (fill each `data-section-intro` div and the intro lede)

**Interfaces:**
- Consumes: the section placeholders from Task 4.

- [ ] **Step 1: Read voice samples first**: at least two posts under `half-built-robots-blog/src/content/` (read-only; that repo is untouched) and the blog's /policies/style page source if present.
- [ ] **Step 2: Draft one short passage per section** (2 to 5 sentences) in Curt's register: short declarative sentences, plain words, no em dashes, no colon-joined clauses, no marketing. Each passage says what the pieces are for and, where the record holds a real story, why they are the way they are. Stories that are in the record and safe to tell: the amber ink was once borrowed from a prototype and failed AA on white, so it was retuned; prose width is never capped because the layout's column is the only width authority; the draft badge exists so unfinished posts can ship visibly. Any rationale not in the record gets `< Curt fill in: ... >`.
- [ ] **Step 3: Intro lede**: what the system is, where it came from (extracted from half-built-robots.com), what the palette editor in the corner does, and that the packages are MIT on npm. Include the `< Curt fill in: ... >` marker only if a claim is uncertain.
- [ ] **Step 4: Verify** build green; grep the page for `—` (must be absent) and for `: ` inside the new prose sentences (colons only in code elements).
- [ ] **Step 5: Commit** `feat(site): section prose in the owner's voice with fill-in markers`.

### Task 7: Browser suite and CI

**Files:**
- Create: `site/test/browser.test.ts`
- Modify: root `package.json` (devDeps `puppeteer-core`, `@axe-core/puppeteer`; script `"test:browser": "vitest run site/test/browser.test.ts"`), `npm install`
- Modify: `.github/workflows/ci.yml` (browser job)

**Interfaces:**
- Consumes: the built site, `@half-built/tooling/test-kit/browser-server.ts` (findChrome, server + launch helpers; read the file for exact exports before writing the suite), the Task 5 DOM contract.

- [ ] **Step 1: Write the suite**, gated so plain `npm test` skips it: `const enabled = process.env.BROWSER_TESTS === "1";` and `describe.skipIf(!enabled)`. Exclude the file from the default vitest run if the root config would otherwise collect it while the gate keeps it green anyway. Body: build once (or require prebuilt dist, matching how the test-kit's server expects to serve), then:
  - axe on the served page in light and dark (`data-theme` stamped before analyze), zero violations at WCAG AA.
  - editor smoke: open the details, set base 1 to `#2f9e44` by dispatching an input event, assert `getComputedStyle(document.documentElement).getPropertyValue("--brand-1-500").trim() === "#2f9e44"` and that some visible accent-colored element's computed color changed from its default.
  - copy block: read the `<pre data-palette-css>` text, assert it matches `/^:root \{$/m` shape lines and declares exactly the six `--brand-*` names.
  - toc smoke: the nav renders one link per section and each `href` target exists.
- [ ] **Step 2: Run locally** with `BROWSER_TESTS=1 npm run test:browser` against a fresh `npm run build:site`. All green.
- [ ] **Step 3: CI job** in ci.yml alongside the existing jobs, ubuntu-latest (Chrome preinstalled at /usr/bin/google-chrome per the test-kit's candidates), steps: checkout, setup-node, `npm ci`, `npm run build:site`, `BROWSER_TESTS=1 npm run test:browser`. Keep the existing tag filter behavior (`branches: ["**"]`) so tags fire only release.yml.
- [ ] **Step 4: Commit** `test(site): axe and editor browser suite with ci job`.

### Task 8: Theming docs

**Files:**
- Modify: `packages/css/README.md` (new "Theming" section), `README.md` (repo root, one status line), `site/README.md` (create if absent: what the site is, dev commands, the Pages build settings from the spec)

**Interfaces:**
- Consumes: the final editor semantics from Tasks 3 and 5.

- [ ] **Step 1: css README Theming section**: the six-variable table from the spec (new names, roles, default values), the copyable example block, one paragraph on the thresholds the defaults meet and that overriders own their own contrast, and a pointer to the reference site as the place to generate a palette. Remember this ships in the tarball at the next publish.
- [ ] **Step 2: Root and site READMEs**: root status paragraph mentions the reference site exists in `site/` and deploys from `main` once the Pages project is live; site README records the Cloudflare build settings (root directory `site`, build `npm run build --workspace site` with install at repo root, output `site/dist`, production branch `main`, preview `dev`).
- [ ] **Step 3: Build + eslint green, commit** `docs: theming surface and reference site notes`.

## Execution notes

- Work lands directly on `dev` in half-built-robots style small commits, no pushes (owner pushes and releases deliberately).
- Owner-blocked steps, recorded here so no task attempts them: merging to `main`, tagging `v0.2.0` (which publishes), bumping the blog's pins (needs the publish), creating the Cloudflare Pages project, DNS.
