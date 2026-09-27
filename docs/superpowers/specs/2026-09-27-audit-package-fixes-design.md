# Audit package fixes for 0.11.0

Date: 2026-09-27. Owner: Curt. Status: sections 1 and 2 approved in
chat; sections 3 to 6 written after sign-off for Curt's morning review
(he approved the whole flow through execution before leaving).

Source: the 2026-09-27 code audit
(`docs/superpowers/reviews/2026-09-27-code-audit.md`), its "Owner
rulings, 2026-09-27" section, and the chat rulings recorded below.
Finding IDs (ISL, CMP, CSS, TOOL, OPS) refer to that doc's appendices.

## 1. Scope and release

Every package-side finding of the audit, the site's own fixes, and the
demo-coverage gaps, all landing on `dev` as 0.11.0. 0.11.0 is not on
npm yet, so no version bump: Curt tags once this batch lands.

In: all ISL, CMP, CSS and TOOL findings except TOOL-8; OPS-9, OPS-13,
OPS-14, OPS-15; ISL-10 in full (code and guard); the demo gaps in
section 6.

Out, later batches: the release pipeline (OPS-1/2/3/5/6/11) as batch
3; the remaining test gaps (OPS-7/8/10/16, TOOL-8) as batch 4.

The blog's pin bump to 0.11.0 is its own change after the release.

## 2. @half-built/css (approved)

- CSS-1: light `--focus-ring` becomes `var(--brand-1-700)`
  (`#a36300`). Dark stays `--brand-2-500`. Target is WCAG 2.1 AA; 1.4.11
  covers focus indicators and axe does not test ring contrast.
- CSS-2: `--umber-500` becomes `#8e7e67` (4.63:1 on `--code-bg`
  `#1b140c`). The Shiki theme (`shiki/code-theme.mjs`) and its hex map
  (`shiki/code-vars.mjs`) change in step, and so do the site's
  `derive-palette.ts` default and its anchor test, which tightens from
  4.3 to 4.5. The live-code-colors spec's open decision is marked
  closed.
- CSS-3: light `--track-y` becomes `var(--brand-2-700)`. The css
  README's ramp note that treats brand-2-500 as exempt ("not text on
  white") is corrected: 1.4.11 covers chart lines.
- CSS-8: `html { scroll-behavior: auto; }` inside the existing
  reduced-motion block in `base/reset.css`.
- CSS-7: add `--z-panel: 18` to the z ladder (consumer fixed panels
  over page floaters, under popouts and tooltips); remove `--z-raised`.
  The five local `z-index: 1` literals stay: they stack inside their
  own dialogs, not on the page ladder.
- CSS-6, CSS-9: retire `--input-border` (both themes),
  `--font-size-xxxl`, `--ink-950`, `--ink-850`, `--ink-700`,
  `--parchment-dim`, `--stroke-1`. `--font-size-xxl` stays: the blog's
  PostLayout reads it (the audit searched only this repo). Standing
  rule from this session: a token a consumer uses is shown on the demo
  site (section 6).
- CSS-4, CSS-5, TOOL-4: a new "Architecture" section in
  `packages/css/README.md` carries the generic content of the blog's
  `docs/css-architecture.md`, rewritten for the package with no blog
  specifics: layers, the visual grammar (patterns), the second accent,
  keyboard focus, themes, tokens (primitives, roles, themes), and lint
  enforcement. The nine file headers that cite `docs/css-architecture.md`
  point at it. The three dead spec paths (lightbox, fluid path player,
  boxed blockquotes) come out of their comments; each comment keeps its
  rationale inline.

Blog impact at its pin bump: `test/tokens.test.ts` drops its
`--input-border` line; parity shows three sanctioned changes (comment
ink, light focus ring, light Y track).

## 3. Islands (@half-built/astro scripts)

- ISL-1: `path-player.ts` fills the play button at build
  (`ICON_PLAY`, `aria-pressed="false"`) beside the restart button, so a
  first open under reduced motion or without a stage shows its glyph.
  The reduced-motion test asserts `.pp-play svg`.
- ISL-2 (ruled: Tab at the edges): the anchored surface stays at the
  end of `<body>`. A keydown handler on the surface takes Tab:
  Shift+Tab from the surface itself or its first focusable closes the
  box and focuses the trigger (a reader-asked close); Tab from its last
  focusable (or from the surface when it holds none) closes the box and
  focuses the first focusable element after the trigger in document
  order, skipping the surface; with none, focus goes to the trigger.
  A focusout listener on the trigger closes the box when focus leaves
  the trigger for somewhere outside both. The sheet is modal and
  unchanged. Proven in the site's browser suite with real key presses,
  since jsdom has no sequential focus navigation.
- ISL-3: plate-modal and the popout sheet record whether the
  `pointerdown` landed on the dialog element itself and close on a
  dialog-targeted click only when it did. A press that starts inside
  and ends on the veil no longer closes.
- ISL-4 (ruled): theme toggle keeps its per-theme action labels and
  drops `aria-pressed` (script and `ThemeToggle.astro`).
- ISL-5: focus-mode stamps `keyboard` on Tab always, and on other keys
  only when the event target is not an editable control (text-like
  `input`, `textarea`, `select`, or contenteditable). Typing in a
  clicked field keeps the pointer highlight.
- ISL-6: lightbox wheel zoom ignores `deltaY === 0` and scales by the
  delta: `factor = exp(-deltaPx * k)` with `deltaMode` normalized
  (lines x 16, pages x box height), so a trackpad's many small events
  zoom smoothly and one mouse notch stays close to today's 1.2x.
- ISL-7: code-island adds one `role="status"` element with the
  package's `.screen-reader-text` class (never `.sr-only`, see
  prose.css) per bar that receives the same COPIED or FAILED text as the button,
  and clears on reset.
- ISL-8: while open, the lightbox listens for resize, re-measures the
  box and re-fits to the initial view; the path player re-runs
  `layoutTracks`. Both listeners go on at open and off at close.
- ISL-9: lightbox `destroy()` closes an open dialog before removing
  it, so the scroll lock clears.
- ISL-10: path player builds its phone query from `BP_PHONE_MAX`, and
  the breakpoint-literal guard scans `packages/astro/src/scripts` as
  well as the CSS files.
- ISL-11 (ruled): `sortEntries` keeps the self entry inside the cap;
  when it would fall past `limit`, it takes the last slot. The "caps at
  the limit" test expects `ui` in the capped list.
- ISL-12: (a) popout is documented as a document-wide singleton, like
  link-tip (README and header comment); `root` is only used to find the
  document. (b) theme-toggle claims each button through `claim` and
  keeps each button's own labels, so one mount's click no longer
  relabels another mount's buttons. (c) focus-mode resolves a
  `Document` root to its `documentElement`.
- ISL-13: frame-loop gives each `start()` a generation; a tick only
  reschedules when its generation is still current, so stop-then-start
  inside the callback keeps one chain.
- ISL-14: one comment-truth pass over `scripts/`: no blog file names
  (`Base.astro`, `henry-loose.ts`), no settled 11.3 decision described
  as open.

## 4. Components (@half-built/astro)

- CMP-1 (ruled): the README's Corner badges paragraph describes
  `badges={[GENAI_BADGE]}` only; no `genai` prop.
- CMP-2, CMP-3: `Popout` and `LightboxLink` type their extra props as
  `Omit<HTMLAttributes<"button" | "a">, ...load-bearing keys>` instead
  of `Record<string, unknown>`, and spread `rest` before their own
  attributes, so a consumer prop can neither type-check against nor
  override `type`, `aria-*`, `href` or `data-popout-label` / `data-lb-*`.
- CMP-4: `ICON_SPARKLES` is removed (no importer in the package or the
  blog; the badge uses the registry `sparkles` glyph).
- CMP-5: README import examples for `scripts/ecosystem` and
  `scripts/popout` gain the `.ts` extension the Import notes require.

## 5. @half-built/tooling

- TOOL-1: `startPreview` wraps its readiness wait in try/catch and
  calls `stopPreview(server)` before rethrowing.
- TOOL-2, TOOL-3: `stylelint-config-standard` (^40.0.0) and
  `postcss-html` (^2.0.0) become dependencies of the tooling package
  and leave the root devDependencies (the workspace install still
  hoists them for the dogfooded root config).
- TOOL-5: `CHROME_CANDIDATES` gains the macOS Chrome and Chromium
  paths; the README documents `CHROME_PATH`.
- TOOL-6: the README's Test kit section names every export of
  `browser-server.ts` and `helpers.ts` with a line each.
- TOOL-7: `engines.node` on the tooling package set to the real floor
  of its dependency graph, checked against the installed manifests
  (`^22.13.0 || >=24`: postcss-html needs `^22.12 || >=24` and eslint
  10 needs `^20.19.0 || ^22.13.0 || >=24`; verified from the installed
  manifests), stated once in the README.
- TOOL-9: the eslint preset's `.ts` globals entries are checked with
  `eslint --print-config`; entries proven inert are dropped, and any
  kept one gets a comment saying which files it serves.
- TOOL-10: the README states the `astroCompressHTML` and Astro
  `compressHTML` invariant as a consumer note. No test.
- TOOL-11 (ruled): `html-validate` and `vitest` become optional peers;
  the README says which subpath needs which peer.

## 6. The demo site

- OPS-13 (ruled): a stub page at the sample post's resolved URL
  (`site/src/pages/2026/09/01/sample-published.astro`) in the Shell:
  one short paragraph saying it is the sample post the PostLink demo
  resolves to, and a link back to the components section.
- OPS-14 (ruled): the second social icon becomes "Packages on npm",
  `https://www.npmjs.com/org/half-built`.
- OPS-9, OPS-15: the site README says the site builds from the
  workspace source (lockfile links) and its pins must equal the package
  version; it names `@half-built/tooling` among what the site
  consumes. `packages/astro/tsconfig.json` drops the missing
  `vitest.browser.config.ts`.
- CSS-7: `site.css` uses `--z-panel` instead of its `calc()`.
- Demo coverage (Curt's rule: a token or component a consumer uses
  appears on the demo site), each with neutral sample content:
  - Type scale: a specimen in the CSS section, one line per
    `--font-size-*` stop, `xs` to `xxl`, labeled with the token name.
  - Corner badges: AI Art on one sample PostCard and on one BlogImage
    demo, Demo on a second card.
  - TwoColumn: it is a page layout (main plus sidebar), so its demo is
  a small framed example in the Frame section.
  - ExcerptStart: a sample card whose excerpt is derived from a sample
    body cut by `ExcerptStart`, with a line saying where the cut is.
  - Path player: a button that opens a player over a small canvas
    stage drawing a geometric placeholder (a point tracing a Lissajous
    curve), with an X/Y lines track on `--track-x` / `--track-y` and a
    band track. No fluid sim, no blog content. Proves ISL-1, ISL-8,
    ISL-10 and CSS-3 on the live site.

## Testing and verification

- TDD for every behavior fix: a failing package test first (jsdom in
  `packages/*/test`), then the fix.
- The site's browser suite (`npm run test:browser`) gains: ISL-2 Tab
  and Shift+Tab with real key presses; ISL-5 typing in a clicked
  field; path player open and play-glyph check; the stub page; axe in
  both themes on the new demos (existing a11y cases cover the page).
- Gates before each commit: `npm test`, `npm run lint`,
  `npm run build:site`; `npm run test:browser` at the end of each
  island or site task and at the batch end.
- No version change; the bump guard stays satisfied because 0.11.0 is
  still newer than the last tag.
