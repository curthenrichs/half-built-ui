# half-built-ui code audit, 2026-09-27

Owner: Curt. Status: batches 2, 3 and 4 (package fixes, release pipeline,
test gaps) landed on dev; the audit is closed apart from the owner's
release.

## Fixed on dev for 0.11.0 (batches 2, 3 and 4, 2026-09-27 and 2026-09-28)

All package-fix findings from the "Suggested order" batch 2 below, landed as ten
commits on `dev` (unpushed, un-tagged; ride 0.11.0 if Curt tags after this
lands), plus the release pipeline hardening (batch 3) and the test-gap
closures (batch 4):

- **CSS-1, CSS-2, CSS-3, CSS-6, CSS-7, CSS-8, CSS-9**: `a84fdc0`
- **CSS-4, CSS-5, TOOL-4**: `6dcb107`, `fe0a05b`
- **ISL-2, ISL-3 (popout sheet/veil), ISL-12 (popout `root`), CMP-2**: `11c0787`, `1547f94`
- **ISL-3 (plate-modal), ISL-6, ISL-8 (lightbox), ISL-9, CMP-3**: `837ca06`, `2648014`
- **ISL-1, ISL-8 (path player), ISL-10, ISL-13**: `7ecbbad`
- **ISL-4, ISL-5, ISL-7, ISL-11, ISL-12 (theme-toggle, focus-mode)**: `7406ce1`
- **CMP-1 (package README correction; the blog-side badge fix is blog `dev` 405e219), CMP-4, CMP-5, ISL-14**: `b3d527c`
- **TOOL-1, TOOL-2, TOOL-3, TOOL-5, TOOL-6, TOOL-7, TOOL-9, TOOL-10, TOOL-11**: `3e2fe15`
- **OPS-9, OPS-13, OPS-14, OPS-15** (plus demo coverage: type scale, content badge, TwoColumn's new `mainTag` prop, ExcerptStart, path player): `9b6b57d`, `2985ce6`
- **OPS-3, OPS-11** (ci.yml: callable via `workflow_call` for release reuse, permissions, triggers, concurrency, timeouts): `408ca79`
- **OPS-1, OPS-2, OPS-3, OPS-5, OPS-6** (release.yml: publish-only job scoped to `id-token: write`, tag-equals-version and main-ancestry checks, full CI including the browser suite gating publish, `npm@11` pinned with no install step, a rerun skips versions already on npm): `51040fe`
- Docs for the release pipeline change: `7482e9b`, `d30bdae`
- **OPS-7** (hermetic browser suite): `5655d61`, `bfd0f61`
- **TOOL-8** (built site passes the html-validate preset; package code-vars
  escapes ">" in Code output; Rail landmarks labeled): `a9ea3db`
- **OPS-8, OPS-10** (numeric bump guard, site pins): `5bf1455`
- **OPS-16** (type gate: tsc + astro check): `cb1c740`
- **OPS-4** (pack smoke, release-only; also dropped tooling's puppeteer-core
  peer, which made any clean consumer install fail with ERESOLVE): `1c84a31`
- Batch 3 carryovers (workflow test hardening, moved-tag gitHead guard,
  plain-tag filter in the bump guard, pack-smoke script safety pin):
  `e4d95ec`, `0555e1e`

Still open, not touched by these batches:

- **OPS-12**: closed by owner ruling (decision 6), actions stay pinned by tag, no further work.

## Context for the session that picks this up

- **Audited tree.** Branch `feat/popout` head `f1c55b7`, which is byte-identical to `dev` at `92859a3` (the no-ff merge of the Popout feature, 2026-09-27). `dev` is 16 commits ahead of `origin/dev` (`97446bc`) and unpushed. All three packages say `0.11.0`, which is **not yet on npm**: the release (push dev, PR to main, merge, tag `v0.11.0`, push the tag) is Curt's step.
- **Consequence for fixes.** Anything that touches the Popout (ISL-2, CMP-2) or other package code can still ride 0.11.0 if it lands before Curt tags; otherwise it needs 0.11.1 or 0.12.0 under the bump guard. Answered: the package fixes in this batch rode 0.11.0.
- **Blog state that interacts with this.** The blog's `dev` tree holds uncommitted Bench Hardware edits (six posts, `tools.mdx`, `src/layouts/Base.astro`, three new photos) that are someone else's in-progress work: do not work over them without asking. The Popout blog adoption (plan `docs/superpowers/plans/2026-09-26-popout.md` Task 6) waits on npm 0.11.0 and on Curt's call about that tree.
- **Method.** Five parallel read-only auditors, one per slice: client islands (`ISL`, `packages/astro/src/scripts`), components and lib (`CMP`), the css package (`CSS`), the tooling package (`TOOL`), and infra, CI, the site and the tests as a whole (`OPS`). Every High and most Medium findings were re-verified by the controller against the code; contrast ratios were recomputed from the hex values. Severities in the prioritized list below are the controller's and override the auditors' where they differ. The auditors' full reports, with every file:line, are the appendices.
- **Settled decisions the auditors were told not to re-raise** (still binding): Astro stays on 5.18; the WhenPublished excerpt leak is parked; the 11.1/11.2 settled list (selector names, literal component breakpoints, `--bp-tablet` unused, CategoryCard image required, Masthead date band, style-guide Subscribe demo); dark theme values and the single `--shadow`; no Dependabot, version bots or changesets; prettier-plugin-astro dropping frontmatter comments; Popout Escape `preventDefault` scope, an anchored note covering the next row's trigger, and `pressing` not clearing on `pointerup`; no cookie banner; no prose width caps; no em dashes; formatting is tooling's job.
- **Popout rulings still open for Curt's eye** (from the build, not the audit): side or above placement for tables instead of "below" (the covered-next-trigger behavior); the parked Escape scope.

## Owner decisions needed

1. **genai badge (CMP-1):** restore a `genai` boolean on BlogImage, GalleryImage and MediaText as authoring sugar, or switch the Okos Polip post to `badges={[GENAI_BADGE]}` and correct the package README and the blog's `content.config.ts` comment. Either way the live post needs its badge back.
2. **Light-theme focus ring (CSS-1):** `#ffaa3c` on white is 1.90:1 against the 3:1 WCAG 1.4.11 floor. The amber ring was an owner call on 2026-08-26.
3. **Theme toggle pattern (ISL-4):** a stable name with `aria-pressed`, or an action label without it.
4. **Code-comment color (CSS-2):** `--umber-500` on `--code-bg` is 4.38:1, just under 4.5:1, in both themes.
5. **Family-2 chart stop (CSS-3):** add a `--brand-2-600` tuned to 3:1 on white for `--track-y`, or document the asymmetry.
6. **Actions pinned by SHA (OPS-12):** a policy call given no Dependabot.
7. **ui site demo:** the PostLink demo's 404 target (OPS-13) and the "Placeholder link" masthead icon to example.com (OPS-14).
8. **Ecosystem cap (ISL-11):** keep the self entry inside `limit`, or reword the invariant.
9. **Optional tooling peers (TOOL-11):** mark `html-validate` and `vitest` optional or not.
10. **New z rung (CSS-7):** whether to add a public rung between scroll-top and popout for consumer chrome.

### Owner rulings, 2026-09-27

Package fixes ride 0.11.0; Curt holds the tag until they land on `dev`.

1. CMP-1: no `genai` prop. The Okos Polip post uses `badges={[GENAI_BADGE]}` (blog `dev` 405e219, one badged figure of ten); the package README's Corner badges paragraph gets corrected.
2. CSS-1: light `--focus-ring` becomes `--brand-1-700` (`#a36300`). The target is WCAG 2.1 AA (the blog's accessibility statement), where 1.4.11 covers focus indicators; axe does not check ring contrast.
3. ISL-4: keep the action labels, drop `aria-pressed`.
4. CSS-2: `--umber-500` retunes to `#8e7e67` (4.63:1 on `--code-bg`); the anchor test tightens to 4.5 and the live-code-colors spec's open decision closes.
5. CSS-3: light `--track-y` points at `--brand-2-700`; no new stop.
6. OPS-12: actions stay pinned by tag.
7. OPS-13: a stub page at the sample post's resolved URL. OPS-14: the placeholder icon becomes "Packages on npm", `https://www.npmjs.com/org/half-built`.
8. ISL-11: the self entry always survives the cap.
9. TOOL-11: `html-validate` and `vitest` become optional peers.
10. CSS-7: add `--z-panel: 18`; the site drops its `calc()`. `--z-raised` is removed as dead.

## Prioritized list

### Fix first

1. **CMP-1, live on the blog.** 0.6.0 (`185d241`, "corner badges as data") removed the `genai` prop from BlogImage, GalleryImage and MediaText, but `packages/astro/README.md` (Corner badges section) and the blog's `src/content.config.ts` comment still describe it. `half-built-robots-blog/src/content/posts/okos-polip-my-device-to-cloud-service.mdx:161` uses `<BlogImage narrow genai …>`; Astro drops the unknown prop, so the post's one AI image ships in production without its AI Art badge. Verified.
2. **CSS-1.** Light-theme focus ring 1.90:1 (decision 2). Verified.
3. **OPS-1, OPS-2, OPS-3, release pipeline.** `release.yml` grants `id-token: write` to the one job that also runs `npm ci` (dependency install scripts), tests, lint and build; any `v*` tag on any commit publishes, with no check that the tag equals the package version or that the commit is on `main`; the browser suite never runs at release. Fix shape: a gates job (read-only) that includes the browser suite, then a publish job with `needs:`, `id-token: write`, `npm ci --ignore-scripts`, and a tag == version and ancestor-of-main check. Verified.
4. **OPS-4 / TOOL-2 / TOOL-3.** `@half-built/tooling`'s stylelint preset extends `stylelint-config-standard` and uses `postcss-html` as the `.astro` custom syntax, and the package declares neither. The blog works only because it lists both itself; the next consumer breaks. The site gate cannot catch it because it links the workspace instead of installing packed tarballs. Fix: declare both as dependencies; consider an `npm pack` smoke install in CI. Verified.
5. **TOOL-1.** `startPreview` (`packages/tooling/src/test-kit/browser-server.ts`) never kills the spawned preview when `waitForServer` rejects; on POSIX the process is detached, so it outlives the run, holds the port, and the next run refuses to start. Likely the source of past orphaned previews. Fix: try/catch around the wait that calls `stopPreview(server)` before rethrowing. Verified.

### Accessibility and behavior bugs

- **ISL-2 (Popout, unreleased):** Shift+Tab out of an open anchored note closes it but lands focus in the footer (the surface is appended at the end of `<body>`); Tab past the last link leaves the document; tabbing on from the trigger does not close the note. Fix: send Shift+Tab back to the trigger and Tab-past-end to the element after the trigger, or move the surface after the trigger while open.
- **ISL-4:** theme toggle changes its label and sets `aria-pressed` (decision 3).
- **ISL-5:** focus-mode stamps `data-focus="keyboard"` on every keydown, so typing in the joined subscribe or search field swaps the click ring for the keyboard ring. Verified.
- **ISL-7:** code-island COPIED and FAILED are not announced (no live region; WCAG 4.1.3).
- **CSS-8:** `scroll-behavior: smooth` is not turned off under `prefers-reduced-motion`. One-line fix. Verified.
- **ISL-1:** path player's play button is empty (no glyph, no `aria-pressed`) on first open under reduced motion or without WebGL. Verified.
- **ISL-6:** lightbox wheel zoom treats `deltaY === 0` (sideways swipe) as zoom out and steps a fixed 1.2x per event, so trackpads jump to the clamps. Verified.
- **ISL-3:** plate-modal and popout sheet close on a click targeted at the dialog, which a drag from inside to the veil produces (text selection in captions).
- **CMP-2 (Popout, unreleased), CMP-3:** `Popout` and `LightboxLink` spread `...rest` after their load-bearing attributes, so a consumer prop can override `aria-expanded`, `type`, `href`, `aria-label` or `data-lb-*` with no type error.
- **ISL-8:** lightbox and path player never re-measure on resize or rotation.

### Contrast decisions

- **CSS-2** code comments 4.38:1 (decision 4). **CSS-3** light `--track-y` 2.02:1 (decision 5). Both verified.

### Tests that do not gate what they should

- **OPS-7:** most browser tests fetch the live ecosystem endpoint; `openPhone()` does not clear storage; fixed sleeps.
- **OPS-8:** bump guard checks "differs from the newest tag", not "newer than".
- **OPS-10:** nothing pins `site/package.json`'s `@half-built/*` versions to the package version (drift silently builds against the old published release).
- **OPS-16:** no `tsc --noEmit` or `astro check` in CI; the packages ship TS source.
- **ISL-10:** `path-player.ts` hardcodes `(max-width: 768px)`; the breakpoint-literal guard only scans CSS.
- **TOOL-8:** the html-validate preset is never exercised in this repo.

### Release and CI hardening

- **OPS-5:** release installs `npm@latest` unpinned and downloads Chrome (no `PUPPETEER_SKIP_DOWNLOAD`).
- **OPS-6:** a partial publish cannot be retried by rerunning (guard each publish with `npm view`).
- **OPS-11:** `ci.yml` has no `permissions`, double-runs on PR branches, no concurrency or timeouts.
- **OPS-12:** actions pinned by tag (decision 6).

### Docs that say false things

- **CSS-4 / TOOL-4 / OPS-15:** nine CSS headers and the shipped stylelint `color-no-hex` message cite `docs/css-architecture.md`, which exists only in the private blog repo. OPS-15 also: `packages/astro/tsconfig.json` includes a missing `vitest.browser.config.ts`; the site README omits tooling from what the site consumes.
- **CSS-5:** three spec paths cited in CSS comments do not exist here.
- **CMP-5:** README import examples for `scripts/ecosystem` and `scripts/popout` omit the `.ts` the README's own Import notes require.
- **OPS-9:** site README's publish-ordering note is wrong (the lockfile links the workspace).
- **TOOL-5, TOOL-6:** test-kit README documents a fraction of its exports; no macOS Chrome candidate; `CHROME_PATH` undocumented.
- **ISL-14:** extraction-era comments name blog files (`Base.astro`, `henry-loose.ts`) and a settled 11.3 decision.

### On the live ui site

- **OPS-13:** PostLink demo links to a 404 (decision 7). **OPS-14:** "Placeholder link" masthead icon to example.com (decision 7).

### Low-priority cleanup

- Dead: `--input-border` (CSS-6), `--z-raised` (CSS-7), seven unused primitives (CSS-9), `ICON_SPARKLES` (CMP-4), inert `globals` blocks for typed `.ts` in the eslint preset (TOOL-9).
- Island contract: lightbox `destroy()` while open leaves the scroll lock (ISL-9); theme-toggle skips `claim()`, focus-mode throws on `document`, popout ignores `root` (ISL-12).
- Latent: frame-loop stop-then-start inside the callback doubles the chain (ISL-13); ecosystem cap can drop self (ISL-11, decision 8).
- Tooling packaging: no `engines` (TOOL-7), `compressHTML` sync by hand (TOOL-10), all peers required (TOOL-11, decision 9).

## Suggested order for the fix session

1. CMP-1 on the blog (live), after Curt picks the fix shape.
2. Package fixes that can ride 0.11.0 if Curt has not tagged yet: ISL-2 and CMP-2 (Popout), CSS-8, TOOL-1, TOOL-2/3, ISL-1, ISL-5, ISL-6, CMP-3, the docs-truth batch.
3. Release pipeline (OPS-1/2/3/5/6/11) as its own reviewed change, since it guards every later publish.
4. Test gaps (OPS-7/8/10/16, ISL-10, TOOL-8).
5. Owner-decision items as Curt rules on them; cleanup last.

## Checked and fine (summary)

No untrusted `innerHTML` (every write is an icon constant; captions, labels and ecosystem text go through `textContent`); the remote ecosystem document is validated, hrefs restricted to http(s), fetch without credentials, one timeout; no module-top-level DOM access (SSR safe); `destroy()` symmetry holds for code-island, focus-mode, link-tip, popout, scroll-top, site-header and subscribe; CI uses `pull_request`, not `pull_request_target`, and interpolates no untrusted input; the exports maps resolve and the tarballs ship what they claim; UTC date handling in lib is consistent; the brand-ramp contrast math in the css README is accurate; the cascade layer order matches every file; light/dark role parity holds; `tsc --noEmit` is clean for site, astro and css; no em dashes in the packages. Each appendix ends with its own full "Checked and fine" list.

---

# Appendices: the auditors' full reports


## Appendix: Islands (ISL) audit

Scope: `packages/astro/src/scripts/` (all files, including `core/`) and the
tests in `packages/astro/test/` that cover them. Branch `feat/popout` at
f1c55b7. Read-only; nothing was run in a real browser, so "likely" below
means traced through the code and the platform rules but not reproduced.

### Findings

#### ISL-1: Path player's play button is an empty box when it opens paused (reduced motion, or no stage)
- Severity: Medium
- Category: bug
- Where: packages/astro/src/scripts/path-player.ts:155-158, :379, :435
- What: `playBtn` is created with no content and no `aria-pressed`. The only place that fills it is `setPlaying()` (line 379). `open()` calls `setPlaying(true)` only when `stageReady && !reduced` (line 435). So on the first open under `prefers-reduced-motion: reduce`, the play control renders as an empty icon box with no pressed state until the reader clicks it. The same happens on the no-WebGL path (`buildStage` returns false), where the disabled button is also empty. After the first close, the `close` handler's `setPlaying(false)` fills it, so it only fails on the first open, which is the one a reader sees.
- Why it matters: the readers who asked for reduced motion get a play control with no visible glyph. The accessible name survives (aria-label), but it has no toggle state. test/path-player-dom.test.ts:132 ("opens paused under prefers-reduced-motion") checks `isPlaying()` and the sink but never looks at the button's markup, so it passes.
- Suggested fix: set `playBtn.innerHTML = ICON_PLAY` and `aria-pressed="false"` at build, next to `restartBtn.innerHTML`. Add an assertion on `.pp-play svg` to the reduced-motion test.
- Confidence: confirmed (the only innerHTML write is line 379; traced both open paths)
- Owner decision needed: no

#### ISL-2: Anchored popout sits at the end of `<body>`, so Tab and Shift+Tab out of it land far from the trigger
- Severity: Medium
- Category: a11y
- Where: packages/astro/src/scripts/popout.ts:98 (`doc.body.append(surface)`), :267-282 (`onFocusOut`)
- What: the non-modal surface is the last thing in `<body>`, and focus moves into it on open. In DOM order, Shift+Tab from the surface goes to the last focusable element before it, which is the page footer, not the trigger. `onFocusOut` sees a destination outside the box and calls `finish(false)`, which does not restore focus, so a keyboard reader ends up in the footer. Tab past the last link inside the note leaves the document for browser chrome, and the next Tab starts again at the top of the page. A related gap: once focus returns to the trigger (allowed, line 271), tabbing on from the trigger closes nothing, because the focusout listener is on the surface only. The note stays open while focus moves through the page.
- Why it matters: every keyboard user who opens a note on a desktop-width screen loses their place in the table. The popout tests use jsdom, which has no sequential focus navigation, so none of them can catch this.
- Suggested fix: handle Tab at the surface's edges. Shift+Tab from the surface or its first focusable goes back to the trigger. Tab from its last focusable closes the note and focuses the next focusable after the trigger (the disclosure-widget manner). Or move the surface in the DOM so it follows the trigger while open, keeping `position: fixed`. Also close on focusout from the trigger when focus goes neither to the box nor to the trigger.
- Confidence: likely (DOM-order reasoning checked against the append site and the focusout logic; not driven in a browser)
- Owner decision needed: no (the fix shape is a choice)

#### ISL-3: Veil and backdrop "click" closes also fire at the end of a drag that started inside
- Severity: Medium
- Category: bug
- Where: packages/astro/src/scripts/plate-modal.ts:89-91; packages/astro/src/scripts/popout.ts:227
- What: both close on `click` when `ev.target` is the dialog element itself. A browser dispatches `click` to the nearest common ancestor of the mousedown and mouseup targets. So a press that starts inside the plate or sheet and is released over the veil gets a click targeted at the dialog, which closes it. Examples: selecting caption text in the lightbox or path player and overshooting onto the veil, or a mouse text selection in the popout sheet (narrow desktop window) that ends on the backdrop. The lightbox's own pan survives only because it takes pointer capture on the viewbox. The path player's stage has no capture, so a drag inside that stage (if the consumer's stage handles pointer input) is exposed the same way.
- Why it matters: the modal disappears under a reader who was selecting text. On a sheet, the note's content goes with it.
- Suggested fix: record whether `pointerdown` also landed on the dialog itself, and close only when both the press and the click hit the veil.
- Confidence: likely (standard click-targeting rule; not reproduced here)
- Owner decision needed: no

#### ISL-4: Theme toggle changes its label and also sets aria-pressed
- Severity: Medium
- Category: a11y
- Where: packages/astro/src/scripts/theme-toggle.ts:72-76 (`reflect`); packages/astro/src/components/ThemeToggle.astro (`aria-pressed="false"` plus label)
- What: the button carries `aria-pressed` and also swaps its accessible name between "Switch to dark mode" and "Switch to light mode". In dark mode a screen reader announces "Switch to light mode, toggle button, pressed". "Pressed" refers to dark mode being on, and the label describes the action that turns it off, so the two contradict each other. ARIA APG: a toggle button's label must not change with its state. Use either a stable name with aria-pressed, or an action label without aria-pressed.
- Why it matters: every screen-reader visitor on every consumer site hears a confusing state on the header's theme control. axe does not flag this, so the blog's a11y gate passes.
- Suggested fix: keep a stable name (for example "Dark mode") with aria-pressed, or drop aria-pressed and keep the action label. `title` can keep the action wording either way.
- Confidence: confirmed (code), a11y judgment per APG
- Owner decision needed: yes (which of the two patterns)

#### ISL-5: Focus-mode flips to "keyboard" on any keystroke, so a clicked-into field loses its click highlight as soon as the reader types
- Severity: Medium
- Category: bug
- Where: packages/astro/src/scripts/focus-mode.ts:34-36, :42; packages/css/src/patterns.css:297-305
- What: every `keydown` (captured on window) stamps `data-focus="keyboard"`, typing included. patterns.css gives `.field-join-input:focus-visible` the `--field-ring` color and switches it to `--focus-ring` under `:root[data-focus="keyboard"]`. So a reader clicks the subscribe or search field (pointer, the field ring shows), types the first character, and the ring changes to the keyboard ring. The click highlight that the island exists to allow (owner rule 2026-08-26) lasts only until the field is used.
- Why it matters: every mouse user of the joined field on every consumer site. The tests dispatch a bare keydown on window, which is the case that should stamp keyboard, so they cannot tell "focus arrived by keyboard" from "typed in a field".
- Suggested fix: stamp keyboard only for navigation keys (Tab, arrows, and so on), or ignore keydowns whose target is an editable control that already holds focus.
- Confidence: confirmed (traced the keydown path into the CSS selector)
- Owner decision needed: no

#### ISL-6: Lightbox wheel zoom zooms out on horizontal scroll and steps 1.2x for every wheel event
- Severity: Medium
- Category: bug
- Where: packages/astro/src/scripts/lightbox.ts:479-487 (line 484)
- What: `rezoom(ev.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, ...)`. With `deltaY === 0`, which is a horizontal trackpad swipe or shift+wheel, the ternary takes the zoom-out branch. The step is also a fixed 1.2x per event whatever the magnitude of `deltaY`. Precision trackpads (macOS, Windows) send dozens of small-delta events per gesture, so one light two-finger scroll or pinch (ctrl+wheel) jumps to the 10% or 800% clamp.
- Why it matters: desktop trackpad users, a large share of desktop readers, get zoom they can't control, and a sideways swipe zooms out. The test (lightbox-dom.test.ts:341) sends one `deltaY: -100` event, so it can't see either problem.
- Suggested fix: ignore events with `deltaY === 0`, and scale the factor by the delta, for example `Math.exp(-deltaY * k)` with deltaMode normalized.
- Confidence: confirmed for the zero-delta branch (code); likely for trackpad feel (not driven on hardware)
- Owner decision needed: no

#### ISL-7: Copy-button outcome is not announced to assistive tech
- Severity: Medium
- Category: a11y
- Where: packages/astro/src/scripts/code-island.ts:54-57, :63-76
- What: the copy outcome ("COPIED"/"FAILED") is shown only by rewriting the focused button's text. No live region is involved. Most screen readers do not announce a name change on the focused button, so the result goes unannounced. WCAG 4.1.3 Status Messages (AA) covers exactly this case.
- Why it matters: screen-reader users get no confirmation, and no failure notice, for every code block on every consumer site.
- Suggested fix: one visually hidden `role="status"` element per mount (or per bar) that receives the same text.
- Confidence: likely (screen reader behavior varies; VoiceOver sometimes reads the change)
- Owner decision needed: no

#### ISL-8: Lightbox and path player measure the box only at open; a resize or rotation leaves fit and HOME wrong
- Severity: Low
- Category: bug
- Where: packages/astro/src/scripts/lightbox.ts:587-589 (the only `boxW/boxH` write); packages/astro/src/scripts/path-player.ts:299-306 (`layoutTracks` runs only from `open`)
- What: neither island listens for resize. When a phone rotates, or a desktop window is resized, with the lightbox open, `fit`, `initialView`, the `0`/HOME/double-click targets and `outOfWhack` all use the stale box, so "fit" no longer fits. In the path player, the timeline canvas bitmap keeps its open-time width and is stretched by CSS (blurry, chip text distorted) until the next open.
- Why it matters: phone readers who rotate to landscape to see a photo or demo bigger, which is a common reason to rotate.
- Suggested fix: a resize listener while open (added in open, removed on close) that re-measures and re-runs `initialView` in the lightbox, and `layoutTracks` in the path player.
- Confidence: confirmed (no resize listener in either; grep)
- Owner decision needed: no

#### ISL-9: Lightbox `destroy()` while the dialog is open leaves the page scroll-locked
- Severity: Low
- Category: bug
- Where: packages/astro/src/scripts/lightbox.ts:626-629; packages/astro/src/scripts/plate-modal.ts:78-81
- What: the `pm-open` scroll lock on `<html>` is cleared only by the dialog's `close` event. Per the HTML spec, removing an open modal dialog from the document does not fire `close`, so `refs.dialog.remove()` on an open lightbox leaves `html.pm-open` (overflow hidden) behind for the rest of the page.
- Why it matters: only for consumers that tear islands down mid-page (client-side routing, view transitions). No current caller does, but destroy() is part of the documented island contract.
- Suggested fix: in destroy, `if (refs.dialog.open) refs.dialog.close()` before `remove()` (or have plate-modal expose a teardown that clears the class).
- Confidence: likely (spec behavior; not reproduced)
- Owner decision needed: no

#### ISL-10: Path player hardcodes the phone breakpoint, and the literal guard does not cover .ts files
- Severity: Low
- Category: test-gap
- Where: packages/astro/src/scripts/path-player.ts:214; packages/astro/test/breakpoints.test.ts:39-55
- What: `"(max-width: 768px)"` is a literal. popout.ts builds its query from `BP_PHONE_MAX`. breakpoints.test.ts's "no system-breakpoint literal survives" check scans only five CSS files, and `core/breakpoints.ts`'s header says a retune "edits both or fails the suite". That promise doesn't hold here. If the breakpoint moves, path-player.css (via `--bp-phone`) and the JS caption toggle split apart. The caption then hides at widths where CSS no longer shows the ABOUT toggle, which strands it: the exact defect the comment at :228-230 describes fixing.
- Why it matters: a latent bug that a future token retune would ship without any test failing.
- Suggested fix: use `BP_PHONE_MAX`, and add the scripts directory to the literal guard.
- Confidence: confirmed
- Owner decision needed: no

#### ISL-11: Ecosystem cap can drop the site's own entry despite the "list missing itself" refusal
- Severity: Low
- Category: correctness-risk
- Where: packages/astro/src/scripts/ecosystem.ts:69-89 (slice at :88); packages/astro/test/ecosystem-dom.test.ts:138-140
- What: `sortEntries` returns null when `selfKey` is absent, "the refusal that keeps a site out of a list missing itself". Then it sorts by priority inside the site's own family and slices to `limit` without keeping self. If a family has more entries than `limit` and the site ranks low, the rendered list leaves out the site itself. The test "caps at the limit" pins this: `sortEntries(DOC.entries, "ui", 2)` gives `["blog", "beadz"]`, without `ui`.
- Why it matters: not today (6 is the default and the families are small), but the output contradicts the function's stated invariant, and a test locks in the contradiction.
- Suggested fix: either always keep the self entry inside the cap, or reword the comment to say the self entry can be capped out. Then adjust the test to whichever is intended.
- Confidence: confirmed
- Owner decision needed: yes

#### ISL-12: Island-contract inconsistencies in popout, theme-toggle, and focus-mode
- Severity: Low
- Category: consistency
- Where: packages/astro/src/scripts/popout.ts:76-83; packages/astro/src/scripts/theme-toggle.ts:78-80, :110-112, :130; packages/astro/src/scripts/focus-mode.ts:22
- What: (a) `mountPopouts(root)` never uses `root`. It claims `<html>` and delegates from `document`, so triggers anywhere in the document open, whatever root was passed (link-tip behaves the same way, but its README/comment says singleton). (b) theme-toggle skips `claim()`/`release()` and uses a module-level `Set`. That is invisible in devtools, which is the reason `core/island.ts` gives for choosing a data attribute, and it is shared across documents. A click also re-labels every mounted button with the clicking mount's `labels`. (c) focus-mode casts `root` to `HTMLElement`, so passing `document`, the call shape every other island uses, throws on `setAttribute` in `claim`.
- Why it matters: consumer surprise, not breakage. The site passes the right shapes today.
- Suggested fix: document popout as document-wide (or honor `root` for trigger lookup), move theme-toggle onto `claim`, and have focus-mode resolve a Document to its `documentElement`.
- Confidence: confirmed
- Owner decision needed: no

#### ISL-13: frame-loop's reentrancy comment covers stop() but not stop() then start() inside the callback
- Severity: Low
- Category: correctness-risk
- Where: packages/astro/src/scripts/core/frame-loop.ts:24-34, :41-46
- What: if `cb` calls `stop()` and then `start()`, `start()` schedules a new rAF and `tick` then runs `scheduleNext()` because `live` is true again. That makes two rAF chains, and `cb` runs twice per frame from then on (the second call with dt 0). No current caller does this: path-player's stop/start happen outside the tick. But `core/` is a public export (`./scripts/*`) and the comment implies the reentrant case is handled.
- Why it matters: a future caller (a sink that restarts the loop) would silently double its per-frame work.
- Suggested fix: give each start a generation counter, and have `tick` bail when its generation is stale. Or `cancelAnimationFrame(handle)` in `start()` before scheduling.
- Confidence: speculative (no current trigger)
- Owner decision needed: no

#### ISL-14: Stale comments pointing at files or decisions that are not in this repo
- Severity: Low
- Category: docs-truth
- Where: packages/astro/src/scripts/site-header.ts:27-30 ("the same function Base.astro uses... is an 11.3 decision"; it now lives in the package's lib and SiteHeader's consumers render it); packages/astro/src/scripts/path-player.ts:25 ("src/scripts/henry-loose.ts's matchMedia guard"), :195, :424; link-tip.ts:38 (henry-loose.ts is a blog file); code-island.ts:6 and lightbox.ts:4 ("Runs/Called from Base.astro", which is a consumer layout, not package code); core/icons.ts:4 ("the to-top chevron in Base.astro"; the same file says Shell.astro at :45)
- What: provenance notes left over from the blog extraction. They send a package reader looking for files that don't exist here and describe an 11.3 decision that has been made.
- Why it matters: maintainer and consumer confusion only.
- Suggested fix: one comment-truth pass over scripts/.
- Confidence: confirmed
- Owner decision needed: no

### Checked and fine
- SSR safety: no script touches `window`/`document`/`localStorage` at module top level. The only module state is theme-toggle's `Set` and path-player's `captionSeq`, both inert under SSR.
- innerHTML: every write (dom.ts `iconButton`, plate-modal close, path-player buttons) takes a constant from core/icons. Captions, labels, ecosystem labels, tip text and copy labels all go through `textContent`.
- Ecosystem document trust: every entry is validated, `href` is restricted to `http(s)://` before it reaches `link.href`, the cached copy goes through the same gate, labels use `textContent`, the fetch uses `credentials: "omit"`, and one 3 s timer covers headers and body.
- Ecosystem failure paths: storage access sits inside try/catch in `safeStorage`, `readCache` and `writeCache`. Non-retryable statuses and content failures skip the retry. Every failure leaves the server-rendered baseline.
- Storage codec (core/storage.ts) and theme-toggle storage: every access is guarded, junk values read as no choice, and a missing storageKey degrades to page-only.
- destroy() symmetry: code-island, focus-mode, link-tip, popout, scroll-top, site-header and subscribe each remove exactly what they add, including capture flags, and release their claims. Double mount is a no-op in each, and the tests cover it.
- Popout scroll handling is rAF-throttled and captured for inner scrollers. Link-tip's scroll/resize handlers only hide. No layout reads happen in a hot path apart from the path player's per-frame `getComputedStyle` for `--ink`, which is cheap while nothing invalidates style.
- matchMedia guards: popout reads its mode at each open and on resize. Link-tip's `(hover: none)` and path-player's reduced-motion check handle a missing matchMedia (jsdom).
- plate-modal scroll lock and focus return: cleared on the `close` event, so Escape, veil, close box and programmatic closes all unlock. The opener gets focus back. The popout sheet's lock is a separate class, so the two can't clear each other.
- Lightbox modifier and middle clicks fall through to the browser. `swapToFull`'s pending guard drops stale full-size loads. HOME is excluded from pointer capture.
- Subscribe: the status line is `role="status"` (Subscribe.astro), the button is disabled in flight, `form.submit()` bypasses the handler on hand-off, and it works with no JS.
- Popout content can't contain lightbox images or fenced code blocks: the README scopes the slot to inline markup, so the islands' mount-time scan missing template clones is not a live gap.
- Link-tip is `aria-hidden` and duplicates the link's own href/`data-tooltip`, Escape dismisses it, and the z ladder puts it above the anchored popout.
- Placement math (core/placement.ts): clamps horizontally with the left edge winning, flips vertically once, and rounds to whole pixels. The unit tests cover it.

## Appendix: CMP (packages/astro/src/components, content/, lib/, shiki/, package.json, README, ICONS-LICENSE) audit

### Findings

#### CMP-1: README promises a `genai` boolean on BlogImage/GalleryImage/MediaText that does not exist
- Severity: High
- Category: docs-truth
- Where: `packages/astro/README.md:45-47` (the "Corner badges" section); `packages/astro/src/components/content/BlogImage.astro:8-16`, `packages/astro/src/components/content/GalleryImage.astro:8-14`, `packages/astro/src/components/content/MediaText.astro:8-15`
- What: The README states "The content components (`BlogImage`, `GalleryImage`, `MediaText`) keep a `genai` boolean as authoring sugar for MDX and take `badges` for anything else." None of the three components declare or destructure a `genai` prop; their `Props` interfaces only have `badges?: Badge[]`. The string `"genai"` exists nowhere in the component source, only as the `key: "genai"` value inside `GENAI_BADGE` in `scripts/core/badges.ts`.
- Why it matters: An author (or a future consumer reading only the README) writing `<BlogImage src={x} genai />` in MDX gets silently no badge at all, since Astro props aren't type-checked against MDX usage at runtime and the extra prop is simply dropped. The only way to get the AI-art badge today is the verbose `badges={[GENAI_BADGE]}` (with an explicit import), which contradicts the documented "authoring sugar" convenience the package claims to offer.
- Suggested fix: Either implement the `genai` boolean (map it to `[GENAI_BADGE, ...(badges ?? [])]` internally) on all three components, or correct the README to describe the actual `badges` API only.
- Confidence: confirmed
- Owner decision needed: yes (whether to build the missing convenience prop or retract the doc claim)

#### CMP-2: `Popout`'s rest-prop spread can override its own load-bearing attributes
- Severity: Medium
- Category: a11y
- Where: `packages/astro/src/components/Popout.astro:2` (`interface Props extends Record<string, unknown>`), lines 8, 11-19 (`{...rest}` placed after `type="button"`, `aria-haspopup="dialog"`, `aria-expanded="false"`, `aria-label`, `data-popout-label`)
- What: `Props extends Record<string, unknown>` removes all excess-property checking for any key the caller passes beyond `label`/`trigger`/`class`. Those extra keys land in `rest`, which is spread onto the `<button>` *after* the component's own `type`, `aria-haspopup`, `aria-expanded`, `aria-label`, and `data-popout-label`. Astro applies attributes in source order, so a caller passing e.g. `aria-expanded="true"`, `type="submit"`, or `data-popout-label="..."` (no compile error, since the index signature types them `unknown`) silently wins over the component's own values. The demo site already exercises this pass-through path for a harmless `id` (`site/src/pages/index.astro:430`), confirming the mechanism is live and consumer-reachable, not theoretical.
- Why it matters: `scripts/popout.ts` and assistive tech both read `aria-expanded`/`aria-haspopup`/`data-popout-label`/native button semantics to drive the disclosure; a colliding prop name (typo'd or a copy-paste from another component) would desync the accessible state or, with `type` overridden inside a `<form>`, change the button's default action, with no type error to catch it.
- Suggested fix: Narrow `Props` to the actual allowed extras (e.g. `id?: string`) instead of `Record<string, unknown>`, or spread `rest` first and let the explicit load-bearing attributes come after so they always win.
- Confidence: likely (traced end to end in source; Astro's documented last-attribute-wins spread order was not exercised against a live render in this read-only session)
- Owner decision needed: no

#### CMP-3: `LightboxLink`'s rest-prop spread can override `href`, `aria-label`, and the lightbox's data attributes
- Severity: Medium
- Category: a11y
- Where: `packages/astro/src/components/LightboxLink.astro:2` (`interface Props extends Record<string, unknown>`), lines 10, 13-22 (`{...rest}` placed after `href`, `data-lb-w`, `data-lb-h`, `data-lb-caption`, `aria-label`)
- What: Same pattern as CMP-2. `Props extends Record<string, unknown>` accepts any extra key with no type error, and `{...rest}` is spread after the component's computed `href`, `data-lb-w`, `data-lb-h`, `data-lb-caption`, and the `aria-label` it builds from `caption`. `LightboxLink` is directly importable by any consumer via the `./components/*` export, not just through the package's own `BlogImage`/`GalleryImage`/`MediaText`/`Step` wrappers.
- Why it matters: A caller passing an extra `href`, `aria-label`, or `data-lb-*` prop (all valid per the loose typing) would silently redirect the lightbox link, replace its computed accessible name, or feed the lightbox script the wrong dimensions/caption, with no compiler warning.
- Suggested fix: Same as CMP-2, either narrow the allowed extra keys or reorder so `{...rest}` cannot clobber the computed attributes.
- Confidence: likely (same reasoning as CMP-2; not executed against a live render)
- Owner decision needed: no

#### CMP-4: `ICON_SPARKLES` is a dead export
- Severity: Low
- Category: dead-code
- Where: `packages/astro/src/scripts/core/icons.ts:101`
- What: `ICON_SPARKLES` is exported alongside the other `ICON_*` raw-markup constants, but nothing in the package (or, per a search of the blog's installed copy, its scripts) imports it by name. `CornerBadges.astro` renders the sparkles glyph through `<Icon name="sparkles" />` (the registry path), not through this constant, unlike `ICON_X`, `ICON_PLAY`, `ICON_PAUSE`, `ICON_ROTATE_CCW`, `ICON_CHEVRON_LEFT`, `ICON_CHEVRON_RIGHT`, `ICON_SUN`, `ICON_MOON`, which are all consumed by a client script (`lightbox.ts`, `path-player.ts`, `plate-modal.ts`, `popout.ts`, `ThemeToggle.astro`).
- Why it matters: Low reach (tree-shaken in practice), but it is unused surface area a future reader might assume is load-bearing.
- Suggested fix: Drop the export, or note why it exists (e.g. future client use) if intentional.
- Confidence: likely (grepped the whole package and the blog's installed copy for `ICON_SPARKLES`; found no import, only the definition and the bundler's dependency-optimizer chunk, which is not evidence of an actual import site)
- Owner decision needed: no

#### CMP-5: README's own subpath-import examples contradict its "Import notes" section
- Severity: Low
- Category: docs-truth
- Where: `packages/astro/README.md:143-198` (the `@half-built/astro/scripts/ecosystem` and `@half-built/astro/scripts/popout` code samples) vs. `packages/astro/README.md:226-229` (the "Import notes" section)
- What: The Ecosystem-island and Popout usage examples both import an extensionless wildcard subpath: `import { mountEcosystem } from "@half-built/astro/scripts/ecosystem";` and `import { mountPopouts } from "@half-built/astro/scripts/popout";`. The same document's "Import notes" section states: "Wildcard subpath imports need explicit file extensions under TypeScript's bundler mode: `@half-built/astro/lib/slug.ts` and `@half-built/astro/components/Shell.astro`, not extensionless forms. Vite resolves either; `tsc --noEmit` only accepts the explicit one."
- Why it matters: A consumer who copies either example verbatim into a `.ts` file that participates in `tsc --noEmit` (or `astro check`) gets a module-resolution error, then has to notice the contradicting note lower in the same README to understand why. It costs a real consumer debugging time for something the README itself already knows and states elsewhere.
- Suggested fix: Add the `.ts` extension to the two `scripts/*` examples for consistency with the stated rule (`@half-built/astro/scripts/ecosystem.ts`, `@half-built/astro/scripts/popout.ts`).
- Confidence: confirmed
- Owner decision needed: no

### Checked and fine
- No `as "x" | "y"` prop casts anywhere in this slice's `.astro` frontmatter; every component destructures `Astro.props` directly (grepped all `components/`, `components/content/`).
- `packages/astro/src/components/content/Step.astro`'s `src as ImageMetadata` cast is a narrow, justified discriminated-union narrowing cast (TS cannot correlate the derived `hasSingle`/`hasMany` booleans back to the union), not the props-untyping trap; the runtime `hasSingle === hasMany` guard throws on both-or-neither, including the empty-`images`-array case.
- `Button.astro`, `Pagination.astro`, `PostNavigation.astro` only spread the package's own array-of-classes or a `labels` object merge, never onto an `<a>`/`<button>`'s attributes in a way a consumer could hijack (checked every `...` occurrence under `components/`).
- `lib/slug.ts`'s `postPath` and `lib/archive.ts`'s `groupByMonth`/`lib/format-date.ts`'s `formatPostDate` all use `getUTC*`/`Date.UTC`/`timeZone: "UTC"` consistently, so post permalinks and date labels do not shift with the build or reader's local timezone; `lib/header-date.ts`'s local-time `formatHeaderDate` is a deliberate exception (a live "today" clock, refreshed client-side, correctly wants the viewer's local date).
- `lib/excerpt.ts`'s block-stripping/flatten/cut pipeline: traced the regex order (image/link/ref-link before html-tag-strip before emphasis/code-mark strip) and the paragraph/non-prose classification; matches its own extensive `test/excerpt.test.ts` fixtures, including the `ExcerptStart` marker, lead-break, and component-block skipping.
- `lib/drafts.ts`'s `postLinkHref`/`resolvePostHref`/`forwardLinkVisible` all throw on an unknown slug (never silently rendering a typo as "still a draft"); covered by `test/lib.test.ts`.
- `lib/paginate.ts`'s `paginatePosts([])` returning `[[]]` (one empty page) is consistent with `Pagination.astro` only rendering when `total > 1`, so an empty archive never crashes or double-renders controls.
- Package.json `exports` map: every target (`./components/*`, `./content/*`, `./lib/*`, `./shiki/code-theme`, `./shiki/code-vars`, plus the `./components/Masthead.astro` exact-key alias to `SiteHeader.astro`) resolves to a file that exists on disk; `files: ["src", "ICONS-LICENSE"]` covers everything actually shipped, no missing tarball entries.
- `ICONS-LICENSE` accurately splits ISC (Lucide) and MIT (Feather-derived subset) terms; every icon name in `icons.ts`'s `GLYPHS` matches the registry list documented in the README exactly (17 keys, both directions).
- `shiki/code-vars.mjs`'s `HEX_TO_VAR` map covers exactly the 6 hex literals `shiki/code-theme.mjs` bakes (background, foreground, and the 4 token colors); no orphaned or missing entries, so the "changes no rendered pixel" README claim holds.
- `peerDependencies` (`astro: ^5.0.0`) matches actual usage: no non-relative, non-`astro` imports anywhere in `components/`, `content/`, `lib/`, or `shiki/`.
- `content/EditorNote.astro`'s `import.meta.env.MODE` read is Vite's own ambient build-mode flag baked into the consumer's bundle, not a read of consumer content/config; matches the CLAUDE.md boundary rule and the README's own description of it.
- `content/Palette.astro`'s scrollable table region: `tabindex="0"` plus `aria-label` on a native `<section>` (not a `div[role=region]`), satisfying both the WCAG 2.1.1 scrollable-region-focusable concern and html-validate's prefer-native-element, as the inline comment documents.
- `content/Walkthrough.astro`'s `role="list"` on a `list-style: none` `<ol>` (restoring the implicit list semantics VoiceOver drops) and its documented, scoped html-validate rule disable.
- `Button.astro` correctly branches `<a href>` vs `<button type>` rather than using one element for both link and action semantics; `PostCard.astro`'s duplicate thumbnail-image anchor is correctly `aria-hidden="true" tabindex="-1"` since the title link already carries the same destination and text.
- `CategoryCard.astro`'s required `image: ImageMetadata` prop (an already-settled decision per the audit brief) confirmed unchanged.
- `Footer.astro`'s `EcosystemEntry` (static baseline props) intentionally omits `priority`/`family`, which only matter to the runtime-fetched `EcosystemDocEntry` in `scripts/ecosystem.ts`; these are two distinct, correctly-scoped types, not an inconsistency.

## Appendix: CSS audit

### Findings

#### CSS-1: Light-theme keyboard focus ring fails non-text contrast against its own surface
- Severity: High
- Category: a11y
- Where: `packages/css/src/tokens/theme-light.css:84` (`--focus-ring: var(--brand-1-500);`), `packages/css/src/tokens/primitives.css:58` (`--brand-1-500: #ffaa3c;`), consumed by the site-wide rule at `packages/css/src/base/reset.css:40-43` (`:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }`)
- What: In the light theme, `--focus-ring` resolves to `--brand-1-500` (`#ffaa3c`). Computed against `--surface` (`#ffffff`, the page/component ground almost every focusable element sits on), the contrast ratio is **1.90:1**. WCAG 1.4.11 (Non-text Contrast, AA) requires 3:1 for UI component/focus indicators. This is the single `:focus-visible` rule the whole system relies on (base/reset.css comment: "Keyboard focus, one answer for the whole site"), so every keyboard-navigated link, button, icon-box, and press-box in light mode gets a ring that is well under the AA floor. The dark theme is fine: `--focus-ring` there is `--brand-2-500` (`#3cc7dd`) against `--black-900`, which computes to 9.37:1.
- Why it matters: every keyboard user on the light theme, on every page, gets a focus indicator that is hard to see against the white/near-white ground it is drawn on. The package's own README documents three contrast thresholds it verified for the brand ramp (700 vs white, 300 vs `#111111`, 600 vs white for "non-text chart line"), but none of those three checks cover the focus-ring role, which uses the 500 (base) stop directly against white, a combination nobody appears to have run through the math.
- Suggested fix: give the light theme a focus-ring value that clears 3:1 against `--surface` (the `--brand-1-600` stop gets to 3.04:1 per the package's own documented math, though that is a chart-tuned value, not a ring-tuned one; a dedicated ring color may be warranted), or reconsider `outline-offset`/an outline+halo combination that adds a contrasting edge.
- Confidence: confirmed (contrast computed via the standard relative-luminance formula from the exact hex values in the file; cross-checked against the package's own verified math for `--brand-1-700` and `--brand-1-600`, both of which reproduced the README's stated ratios to 2 decimal places).
- Owner decision needed: yes (the amber-500 ring is a deliberate "owner call 2026-08-26" brand choice; fixing it changes what the ring looks like).

#### CSS-2: Code-comment token color fails AA text contrast on the code surface, in both themes
- Severity: Medium
- Category: a11y
- Where: `packages/css/src/tokens/primitives.css:83` (`--umber-500: #8a7a63;`), `packages/css/src/tokens/theme-light.css:51` and `packages/css/src/tokens/theme-dark.css:49` (`--code-token-comment: var(--umber-500);`), code surface at `--code-bg: var(--ink-900)` (`#1b140c`, identical in both themes per `theme-light.css:40` / `theme-dark.css:38`)
- What: `--umber-500` (`#8a7a63`) against `--ink-900` (`#1b140c`) computes to **4.38:1**, below the 4.5:1 AA floor for normal-size text. Since the code surface and the comment token color are identical in both themes (both intentionally "the same warm block... in both themes" per the theme-dark.css comment), the shortfall ships in both light and dark mode wherever a Shiki-highlighted code block contains a comment.
- Why it matters: comment text in every code sample on the blog (a real, frequently-used content type) sits just under the AA line for low-vision readers. It is close (4.38 vs 4.5) but is a real, computed miss, and unlike the other syntax-token roles (keyword 9.62:1, function 12.80:1, string 6.13:1), it was not covered by the three-threshold verification the README documents for the brand ramp, because `--umber-500` is a "fixed system color" outside that ramp with no stated contrast target at all.
- Suggested fix: darken `--umber-500` slightly (or lighten `--code-bg` slightly) to clear 4.5:1; re-run the two Shiki-mapped hex values in `packages/astro/src/shiki/code-vars.mjs` and the site's `derive-palette.ts`/`palette-editor` tests, which already assert contrast ratios for this exact pair (`site/test/derive-palette.test.ts:66,106,153`) but appear to be asserting against a different comparison than "does the current shipped default itself pass" (see CSS-3-adjacent risk: those tests are outside this slice, but the shipped default value they're validating against is `packages/css/src/tokens/primitives.css:83`).
- Confidence: confirmed (relative-luminance computation from the exact hex values).
- Owner decision needed: yes (a value change to a fixed "system color" the comment explicitly calls out as staying constant across brand overrides).

#### CSS-3: Family-2 has no "chart kin" stop; `--track-y` fails 3:1 non-text contrast on the light surface
- Severity: Medium
- Category: a11y / consistency
- Where: `packages/css/src/tokens/theme-light.css:63` (`--track-y: var(--brand-2-500);`), `packages/css/src/tokens/primitives.css:61-63` (family 2 only defines `--brand-2-300`, `--brand-2-500`, `--brand-2-700`, no `--brand-2-600`), README table at `packages/css/README.md:64-71`
- What: Family 1 has a dedicated 600 stop tuned specifically to clear 3:1 as a "non-text chart line on the light paper" (primitives.css:54-57, verified: `--brand-1-600` on white computes to 3.04:1, matching the file's own comment). Family 2 has no equivalent 600 stop, so the light theme's `--track-y` (the path-player's second data-track color) falls back to `--brand-2-500` (`#3cc7dd`) directly. Computed against `--surface` (white), that is **2.02:1**, below the WCAG 1.4.11 3:1 floor for a meaningful graphical object (a chart/timeline data series). By contrast, `--track-x` (family 1, using the tuned 600 stop) passes at 3.04:1. The dark-theme `--track-y` (`--brand-2-300` on `--black-900`) is fine at 13.26:1.
- Why it matters: on the FluidPathPlayer (used on the UR5/robotics posts), the Y-axis track line is meaningfully harder to see against the light-theme plate than the X-axis track line, for readers relying on the graphic rather than a table of numbers. It also means the README's own reasoning ("brand-2-500 matches brand-1-500's contrast on both grounds... not text on white") treats "not text" as exempting the pair from a contrast obligation, but WCAG 1.4.11 covers non-text graphical objects too, so that reasoning doesn't actually clear the bar it's implicitly claiming to.
- Suggested fix: add a `--brand-2-600` stop tuned to 3:1 on white (mirroring how `--brand-1-600` was tuned), and point `--track-y` (light) at it instead of the 500 stop; or accept the asymmetry as intentional and document why family 2 doesn't get the same treatment.
- Confidence: confirmed (contrast computed from hex values; ramp asymmetry confirmed by reading `primitives.css` directly, family 1 has 4 named stops, family 2 has 3).
- Owner decision needed: yes (adding a token to the public theming surface, or accepting the gap, is a design call).

#### CSS-4: `docs/css-architecture.md` is cited nine times across the package but does not exist
- Severity: Medium
- Category: docs-truth
- Where: cited in `packages/css/src/global.css:1`, `layers.css:1`, `tokens.css:1`, `base/reset.css:1`, `base/shell.css:1`, `code.css:1`, `patterns.css:1`, `prose.css:1`, `tokens/primitives.css:1` (nine files total)
- What: every one of these files opens with a comment pointing readers at "docs/css-architecture.md" for the fuller cascade/architecture rationale. No such file exists anywhere in the repo (`find . -iname "css-architecture.md"` returns nothing; the repo's `docs/` tree only contains `docs/superpowers/{plans,specs}`, both of which start at 2026-09-05).
- Why it matters: this is the doc nearly every file in the package's `src/` tree points to as "the" architecture reference. Anyone (human or agent) following that pointer while orienting in the codebase hits a dead end, and has no way to tell whether the doc was deleted, never migrated from the blog repo during extraction, or never existed at all.
- Suggested fix: either write `docs/css-architecture.md` (the content it's meant to hold is scattered across these nine header comments and could be consolidated), or strip the dangling references if the doc is deliberately gone.
- Confidence: confirmed (exhaustive file search across the repo).
- Owner decision needed: no (this is a plain broken reference; the only decision is whether to write the doc or remove the pointers).

#### CSS-5: Three component specs cited by path/date don't exist in the repo
- Severity: Low
- Category: docs-truth
- Where: `packages/css/src/lightbox.css:2` cites `docs/superpowers/specs/2026-07-30-image-lightbox-design.md`; `packages/css/src/plate-modal.css:2` and `packages/css/src/path-player.css:1-2` cite `docs/superpowers/specs/2026-08-22-fluid-path-player-design.md`; `packages/css/src/prose.css:92` cites `docs/superpowers/specs/2026-08-14-boxed-blockquotes-design.md`
- What: `docs/superpowers/specs/` currently holds only five files, none matching these three names or dates (`2026-09-05-reference-site-design.md`, `2026-09-06-ecosystem-endpoint-design.md`, `2026-09-06-live-code-colors.md`, `2026-09-26-popout-design.md`, `2026-09-26-when-published-fallback-design.md`). By contrast, the two other spec references in this package (`primitives.css:42` and `popout.css:2`) do resolve to real files. This looks like leftover pointers from before the blog's spec docs were pruned or never carried into this repo at extraction.
- Why it matters: lower reach than CSS-4 (these are component-specific rationale docs, not the central architecture doc), but the same dead-end problem for anyone chasing "why does the lightbox/player/blockquote look like this."
- Suggested fix: same as CSS-4, scoped to these three files, recover or rewrite the specs, or remove the dangling paths.
- Confidence: confirmed (file search against the actual `docs/superpowers/specs` and `docs/superpowers/plans` listings).
- Owner decision needed: no.

#### CSS-6: `--input-border` is defined in both themes but has zero consumers
- Severity: Low
- Category: dead-code
- Where: `packages/css/src/tokens/theme-light.css:17` (`--input-border: var(--gray-300);`), `packages/css/src/tokens/theme-dark.css:21` (`--input-border: var(--gray-750);`)
- What: this role is declared with parity in both theme files (so it isn't a light/dark-parity bug), but a repo-wide search for `var(--input-border)` or `--input-border` outside its own two definitions turns up nothing in `packages/css`, `packages/astro`, or `site`. The theme file's own header comment says these are "the only names components read," but nothing reads this one. The joined-field pattern (`.field-join`, `patterns.css:272-326`), which is the system's only text-input styling, uses `--field-ink`/`--rule` instead.
- Why it matters: low reach (dead token, not a bug a consumer would hit), but it's an unmaintained piece of the public theming surface, a future edit to it would silently change nothing, and a contributor styling a new input might reasonably reach for it expecting it to do something.
- Suggested fix: wire it into the joined-field border (or a future plain `<input>` reset) or retire it.
- Confidence: confirmed (repo-wide grep for the property name).
- Owner decision needed: no.

#### CSS-7: `--z-raised` is defined but unused, and the ladder has no public rung between scroll-top and popout
- Severity: Low
- Category: dead-code / dx
- Where: `packages/css/src/tokens/primitives.css:119` (`--z-raised: 1;`); five local `z-index: 1` literals that could plausibly want a named rung instead: `lightbox.css:90`, `path-player.css:60`, `patterns.css:319`, `plate-modal.css:115`, `plate-modal.css:149`; consumer workaround at `site/src/styles/site.css:39` (`z-index: calc(var(--z-scroll-top) + 1);`, with the comment "One z step above --z-scroll-top keeps an open panel over every page floater")
- What: `--z-raised` is the bottom rung of the documented z-ladder but is never referenced anywhere in the repo (package or site). Meanwhile, every place in the package that needs to lift an element one step above a sibling uses a bare `z-index: 1` instead (these are local, small-scale stacking contexts inside dialogs, so they're not really the same use case `--z-raised` seems aimed at). Separately, the site's own sticky/fixed rail chrome needs to sit above `--z-scroll-top` but below `--z-popout`, and since the ladder has no rung there, it computes `calc(var(--z-scroll-top) + 1)`, coupling consumer code to the numeric gap between two package-internal values instead of a stable named rung.
- Why it matters: `--z-raised` is dead weight in the public token surface (a rung nothing climbs), and the ladder's gap forces at least one real consumer into fragile arithmetic on values it shouldn't need to know the exact numbers of.
- Suggested fix: either wire `--z-raised` into the five local `z-index: 1` spots it seems to describe, or drop it; separately, consider a named rung (e.g. `--z-raised-chrome`) between scroll-top and popout for consumer-authored fixed UI, so `site.css` doesn't need `calc()` against an internal token.
- Confidence: confirmed (repo-wide grep for `z-raised`; site.css read directly).
- Owner decision needed: no for removing the dead token; yes for adding a new public rung (theming-surface change).

#### CSS-8: `scroll-behavior: smooth` is not disabled under `prefers-reduced-motion`
- Severity: Medium
- Category: a11y
- Where: `packages/css/src/base/reset.css:9-11` (`html { scroll-behavior: smooth; }`), reduced-motion guard at `base/reset.css:67-72` (`@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }`)
- What: the package's blanket reduced-motion guard only zeroes out `animation` and `transition`, which is comprehensive for every actual `animation`/`transition`/`@keyframes` use in the package (link-tip fade, scroll-top hover transform, icon-box hover, popout's sheet-rise keyframe, all confirmed covered). `scroll-behavior` is a separate CSS property that this guard does not touch, and there is no `@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }` override anywhere in the repo.
- Why it matters: any in-page scroll driven by the browser's native smooth-scroll (skip-link activation, in-page anchors, "scroll to top") keeps animating for users who have explicitly asked the OS/browser for reduced motion, which is exactly the vestibular-triggering case that setting exists to avoid.
- Suggested fix: add `@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }` (either inside the existing reduce block or alongside it).
- Confidence: confirmed (read both rules directly; grepped the whole package for `scroll-behavior` to confirm no existing override).
- Owner decision needed: no (this is a one-line, uncontroversial completion of an existing guard, not a design call).

#### CSS-9: A cluster of primitives are defined but never consumed anywhere in the repo
- Severity: Low
- Category: dead-code
- Where: `packages/css/src/tokens/primitives.css:130,137` (`--font-size-xxl`, `--font-size-xxxl`), `:20,22,24` (`--ink-950`, `--ink-850`, `--ink-700`), `:26` (`--parchment-dim`), `:86` (`--stroke-1`)
- What: a repo-wide search (`packages/css`, `packages/astro`, `site`, excluding `dist`) for each of these names turns up only their own definition line. This is different from `--track-x`/`--track-y`/`--track-z` and the `--code-token-*` roles, which looked unused by the same search but are actually read at runtime via `getComputedStyle`/a JS transformer (confirmed in `packages/astro/test/path-player-*.test.ts` and `packages/astro/src/shiki/code-vars.mjs`), these seven have no such indirect consumer that I could find.
- Why it matters: low; this is cleanup, not a defect a consumer would hit. Flagging it because the package's own convention (primitives feed roles, roles feed components) implies every primitive should trace to at least one role or direct component use, and these don't.
- Suggested fix: wire them in where intended (e.g. `--ink-700/850/950` look like they belong to the warm-dark ramp that `--ink-900`/`--ink-800` already serve; `--font-size-xxl/-xxxl` look like the top of the fluid type scale that nothing currently reaches) or retire them.
- Confidence: confirmed (repo-wide grep), likely that they are genuinely dead rather than consumed some other way (speculative on *why* they're unused, confirmed that they *are*).
- Owner decision needed: no.

### Checked and fine
- Cascade layer order: every file's `@layer` declaration (`base/*` → base, `patterns.css` → patterns, `code.css`/`popout.css`/`prose.css` → components, `plate-modal.css` → components.plate, `lightbox.css` → components.lightbox, `path-player.css` → components.player, `tokens/*` → tokens) matches the order declared once in `layers.css:10`; no file declares an undeclared layer and no declared layer goes unused.
- Light/dark role parity: every role in `theme-light.css` has a matching role in `theme-dark.css` except `--stroke`, which is deliberately theme-invariant per its own comment ("2px here, 3px on BEADZ"); confirmed via a full diff of the two files' custom-property names.
- README's brand-ramp contrast math: independently recomputed all three stated thresholds from the raw hex values in `primitives.css` and got the same numbers the comments claim, `--brand-1-700` vs white: 4.84 (claimed 4.84); `--brand-1-600` vs white: 3.04 (claimed 3.04); `--brand-2-300` vs `#111111`: 13.26 (claimed "clears 4.5:1"). The documentation here is unusually precise and accurate.
- Exports map vs README: `package.json`'s `"./*": "./src/*"` wildcard, plus the explicit `.`/`./layers`/`./tokens` entries, cover every import the README tells consumers to use, including the nested `@half-built/css/tokens/breakpoints.css` path used in its postcss recipe.
- `@custom-media` consumer setup: the README's documented postcss-custom-media + postcss-global-data recipe is exactly what `site/postcss.config.mjs` actually runs, confirming the recipe works as documented in the one place it's exercised in this repo.
- `:focus-visible` coverage: no rule in the package sets `outline: none` (or removes focus visibility) without a replacement; the two intentional local overrides (`.field-join-input`, `.field-join-button` in `patterns.css`) are documented, deliberate exceptions (inset rings so an outside ring doesn't cut across the fused input+button box), not suppressions.
- Hard-coded colors bypassing tokens: outside `tokens/` (where hex is explicitly permitted by `packages/tooling/src/stylelintrc.json`'s `color-no-hex` override), the only non-token color values in the whole package are `rgba(0, 0, 0, 0)` (a fully transparent gradient stop in `.bracket-frame`, alpha 0 so the RGB channels are moot) and one fixed `text-shadow` on `.draft-stamp`, consistent with the already-settled precedent that `--shadow` is a single fixed value regardless of theme.
- Selector scoping: no component selector reaches outside its own class/root (all `.prose`, `.lb-*`, `.pm-*`, `.pp-*`, `.popout*`, `.field-join*` rules are scoped under their own class); the only bare-element selectors (`html`, `body`, `a`, `*`, `:focus-visible`) live in `base/reset.css` and are the intentional site-wide reset, not a leak.
- `packages/css/test/css-pins.test.ts`: ran it directly (`npx vitest run packages/css/test/css-pins.test.ts`), all 7 pins pass; read each assertion and none is tautological, they pin concrete, checkable facts (both themes define `--focus-ring`, the shipped amber hex, all four breakpoint names exist, the prose stylesheet's only `max-width` is the image-fit exception, the link-tip's hover:none backstop text, the popout's z-order relative to scroll-top and tooltip, and popout.css's mode/scroll-lock/reduced-motion structure).
- `--bp-tablet`: confirmed zero consumers inside `packages/css` itself (matches the settled owner decision, not re-raised); noted only for context that `site/src/styles/site.css:294` does now consume it, which is a non-issue (more use, not less).
- Package version: `packages/css/package.json` is at `0.11.0`, matching the brief's stated branch state.

## Appendix: TOOL audit: packages/tooling/

### Findings

#### TOOL-1: startPreview leaks the child process when the readiness check fails
- Severity: High
- Category: bug
- Where: packages/tooling/src/test-kit/browser-server.ts:91-115 (startPreview), in conjunction with :39-41 (blog's beforeAll usage pattern, e.g. half-built-robots-blog/test/browser-smoke.test.ts:34-43)
- What: `startPreview` spawns the preview server, then `await waitForServer(...)`. If `waitForServer` rejects for any reason other than the process already having exited (a 404 at the ready path, or the 60x500ms timeout expiring while the process is merely slow), the spawned, *running* `ChildProcess` is never captured or killed before the rejection propagates. The caller's `server = await startPreview(...)` assignment never completes, so `server` stays `undefined`, and the caller's own `afterAll(() => stopPreview(server))` calls `stopPreview(undefined)`, which is a no-op (`browser-server.ts:120`, `server?.pid == null` short-circuits). On POSIX this is worse than a normal orphan: the process is spawned with `detached: true` (`browser-server.ts:110`), so it is not even in the same process group as the test runner and outlives it unconditionally.
- Why it matters: any consumer's browser suite (the blog's `test/browser-smoke.test.ts`, `test/a11y.test.ts`, `test/tickets-browser.test.ts`, and any future BEADZ/portfolio suite that adopts this test-kit) leaks a live `astro preview` process on a real, non-transient failure mode (wrong ready path, slow CI runner). The leaked process keeps holding the port, so the *next* CI run or local run hits `startPreview`'s own guard at line 98-102 ("something already serves http://localhost:PORT; kill it before running the browser suites") and fails for a reason that has nothing to do with the change under test, on a runner where nobody can manually `kill` anything.
- Suggested fix: wrap the `await waitForServer(...)` call in a try/catch inside `startPreview` that calls `stopPreview(server)` before rethrowing.
- Confidence: confirmed (traced end to end: the missing cleanup path, the `detached: true` on POSIX, and the no-op `stopPreview(undefined)` on the consumer side, cross-checked against the blog's actual `beforeAll`/`afterAll` usage).
- Owner decision needed: no.

#### TOOL-2: stylelint preset extends "stylelint-config-standard" but the package never declares it
- Severity: High
- Category: bug
- Where: packages/tooling/src/stylelintrc.json:2 (`"extends": ["stylelint-config-standard"]`); packages/tooling/package.json:22-42 (dependencies/peerDependencies, neither lists it)
- What: The shipped stylelint preset's very first line extends `stylelint-config-standard`, but `@half-built/tooling`'s `package.json` has no `dependencies` entry and no `peerDependencies` entry for `stylelint-config-standard`. It only exists in this monorepo's own root `package.json` (devDependencies, half-built-ui/package.json:30), which is what masks the gap when running `npm run lint` inside this repo.
- Why it matters: a fresh consumer who does `npm install @half-built/tooling` (and its documented peers: eslint, stylelint, html-validate, puppeteer-core, vitest, prettier) and then runs stylelint with `@half-built/tooling/stylelint` gets a hard `Cannot find package 'stylelint-config-standard'` at config-load time, for a package the README never told them to install. Confirmed live: the reference consumer (half-built-robots-blog/package.json:51) already had to add `"stylelint-config-standard": "^40.0.0"` to its own devDependencies by hand, undocumented anywhere in this package.
- Suggested fix: add `stylelint-config-standard` as a `dependency` of `@half-built/tooling` (same treatment as the eslint plugin dependencies), pinned compatibly with the `stylelint` peer range (^17.x). A dependency, not a peer, since the consumer has no reason to choose its own version.
- Confidence: confirmed (read both package.json files directly; verified `stylelint-config-standard` peer-requires `stylelint ^17.0.0`, compatible with the declared `stylelint` peer range).
- Owner decision needed: no.

#### TOOL-3: stylelint's `.astro` override requires "postcss-html" but it's never declared either
- Severity: High
- Category: bug
- Where: packages/tooling/src/stylelintrc.json:41-44 (`{"files": ["**/*.astro"], "customSyntax": "postcss-html"}`); packages/tooling/package.json:22-42
- What: Same shape of bug as TOOL-2, a second time in the same file. Linting any `.astro` file with this preset requires the `postcss-html` package to be resolvable as `customSyntax`, and it is declared nowhere in `@half-built/tooling`'s manifest, dependency or peer. It exists only in the root workspace's own devDependencies (half-built-ui/package.json, not shown in the package's own tree) and, again, in the blog's own devDependencies (half-built-robots-blog/package.json:46, `"postcss-html": "^1.8.1"`), added by hand.
- Why it matters: since the whole point of this design system is Astro components, virtually every real consumer will lint `.astro` files. Without `postcss-html` declared, that's the majority of the intended surface of the stylelint preset, broken on a bare install.
- Suggested fix: add `postcss-html` as a `dependency` of `@half-built/tooling` (note its own `engines` field requires Node ^22.12 or >=24, see TOOL-7).
- Confidence: confirmed.
- Owner decision needed: no.

#### TOOL-4: color-no-hex error message points at a doc that doesn't exist in this repo
- Severity: Medium
- Category: docs-truth
- Where: packages/tooling/src/stylelintrc.json:8 (`"message": "Hex colors live in tokens.css only; use var(--...) (docs/css-architecture.md)"`)
- What: The message names `docs/css-architecture.md`. That path exists in `half-built-robots-blog` (half-built-robots-blog/docs/css-architecture.md) but was never carried over or recreated in `half-built-ui` (confirmed: no `docs/css-architecture.md` anywhere under this repo, nor in the published tarball, since `files` only ships `src`). The reference to it is stale from the 11.3 extraction.
- Why it matters: anyone who trips this rule, in this repo, in a consumer of the package, or in a future BEADZ/portfolio adopter, gets pointed at a file that only exists in a private repo they likely don't have access to.
- Suggested fix: either point the message at wherever the design rule is now documented in half-built-ui (or drop the doc pointer and keep the one-line rule statement), and check for other stray `docs/*.md` references carried over from the blog extraction.
- Confidence: confirmed.
- Owner decision needed: no (it's a stale pointer, not a design call).

#### TOOL-5: findChrome() has no macOS candidate and its CHROME_PATH escape hatch is undocumented
- Severity: Medium
- Category: correctness-risk / dx
- Where: packages/tooling/src/test-kit/browser-server.ts:16-26 (`CHROME_CANDIDATES`)
- What: The candidate list covers Windows (three variants) and Linux CI (`/usr/bin/google-chrome`, `/usr/bin/chromium-browser`, `/usr/bin/chromium`), but no macOS path (e.g. `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`). `CHROME_PATH` is checked first and would work around this, but it is not mentioned in packages/tooling/README.md, half-built-ui's root README, or half-built-ui/CLAUDE.md; the only place it's discoverable is by reading this source file's comment on line 17.
- Why it matters: this is a shared test-kit meant for "half-built sites" generally, not just the blog (which was developed on Windows, per this session's own environment and per the CHROME_CANDIDATES list's Windows-first ordering). Any contributor to the ui site, blog, BEADZ, or portfolio working from a Mac gets a hard `findChrome` throw with no documented fix.
- Suggested fix: add the standard macOS Chrome path(s) to CHROME_CANDIDATES, and document `CHROME_PATH` as the override in the README's Test kit section.
- Confidence: confirmed (the same list, same gap, was already present verbatim in the blog's original `scripts/find-chrome.mjs` before extraction, so this isn't a regression from the move, but it is a real, currently-shipping gap in a package now positioned for reuse beyond the blog's own machines).
- Owner decision needed: no (unless macOS is deliberately out of scope, in which case it should say so).

#### TOOL-6: README documents a fraction of the test-kit's actual surface
- Severity: Medium
- Category: docs-truth
- Where: packages/tooling/README.md:29-33 ("## Test kit" section)
- What: The whole "Test kit" section is four lines about `browser-server.ts` and `launchChrome`/`puppeteer-core`. It never mentions `startPreview`, `stopPreview`, `findChrome`, `desktopPage`, `phonePage` (all exported from browser-server.ts), or `test-kit/helpers.ts` at all: `stubRafOnFakeTimers`, `polyfillDialog`, `recordingContext`/`CanvasCall`/`RecordingContext` are entirely undocumented, despite being exported via the package.json's `"./test-kit/*"` wildcard and being generically useful (the brief's own framing: "generic DOM and canvas test scaffolding any consumer's suite can use").
- Why it matters: a new consumer (BEADZ, portfolio) reading the README to decide whether to adopt the test-kit would not learn that preview-server orchestration, viewport helpers, or DOM/canvas test scaffolding exist at all without reading the source directly.
- Suggested fix: expand the "Test kit" section to name both files and their exports, matching the level of detail given to the lint presets above it.
- Confidence: confirmed (read the full README and the full source of both test-kit files).
- Owner decision needed: no.

#### TOOL-7: no documented Node version floor for the tooling package's own dependency graph
- Severity: Low
- Category: dx / docs-truth
- Where: packages/tooling/package.json (no `engines` field); half-built-ui/package.json (no `engines` field); README.md / CLAUDE.md (no stated Node minimum)
- What: The peer/dependency graph a consumer must install has real, inconsistent Node floors that are never surfaced: `eslint@^10.8.0` requires Node `^20.19.0 || ^22.13.0 || >=24` (excludes Node 18, Node 21, and most of the Node 20/22 minor range), `postcss-html` (needed per TOOL-3) requires `^22.12 || >=24`, `puppeteer-core` requires `>=22.12.0`, and `stylelint`/`stylelint-config-standard` require `>=20.19.0`.
- Why it matters: a consumer on a Node LTS that looks current (e.g. plain Node 20.0-20.18, or Node 21) gets no warning from this package about incompatibility until `npm install` prints peer/engine warnings for packages they didn't know they needed (see TOOL-2/TOOL-3), or until a tool refuses to run.
- Suggested fix: add an `engines.node` field to `packages/tooling/package.json` reflecting the real floor (effectively `^20.19.0 || ^22.13.0 || >=24` today) and state it once in the README.
- Confidence: confirmed (read `engines` fields directly from the installed packages).
- Owner decision needed: no.

#### TOOL-8: htmlvalidate.json preset is never exercised anywhere in this repo
- Severity: Low
- Category: test-gap
- Where: packages/tooling/src/htmlvalidate.json (whole file); no reference to `html-validate` or `htmlvalidate.json` anywhere else in half-built-ui outside `packages/tooling/package.json`'s own exports entry
- What: Unlike the eslint, stylelint, and prettier presets (all dogfooded by the root config files per CLAUDE.md), nothing in this repo (`site/`, the packages, or CI) actually runs html-validate against this JSON. It currently loads and validates correctly against the pinned peer (`html-validate@9.7.1`, checked directly), so it is not broken today, but a future html-validate major bump, or a rule rename/removal upstream (e.g. `valid-id`'s `relaxed` option, `long-title`, `prefer-button`), would only be caught when a consumer's own build breaks, since CLAUDE.md's note that "consumers keep a local copy of htmlvalidate.json" also means this repo has no consumer of its own copy to catch it here first.
- Why it matters: this preset has no safety net of its own; the blog is currently the only thing proving it works, and that proof lives outside this repo.
- Suggested fix: add a small test in `packages/tooling` (or `site/`) that loads `htmlvalidate.json` and runs it against a trivial HTML fixture, asserting it still parses and validates, so a peer-version bump that breaks a rule name fails here before it reaches a consumer.
- Confidence: confirmed (grepped the whole repo for `html-validate`/`htmlvalidate` usage outside the tooling package itself; verified the config currently loads fine against the installed peer).
- Owner decision needed: no.

#### TOOL-9: dead globals overrides for typed `.ts` files in the eslint preset
- Severity: Low
- Category: dead-code
- Where: packages/tooling/src/eslint.config.mjs:130-133 (`files: ["**/test/**/*.ts"]` → `globals.node`); also the `**/*.astro/*.ts` entry inside the combined array at :139-143
- What: `tseslint.configs.strictTypeChecked` (applied to all `**/*.ts` files at :24-28) turns `no-undef` off (confirmed with `eslint --print-config` against a real file: `"no-undef": [0, {"typeof": false}]`, both on a plain `.ts` script and on a `.ts` test file). `no-undef` is the rule that actually consumes `languageOptions.globals` for undefined-identifier checking. With it off, the `globals.node` injection for `**/test/**/*.ts` (and the `.ts` half of the browser-globals array) has no observable effect on lint results; confirmed empirically (`--print-config` on `packages/astro/test/lib.test.ts` shows `process` present in globals while `no-undef` stays `[0, ...]`).
- Why it matters: low impact today (nothing currently relies on it), but it's misleading to read: the comments describe these blocks as load-bearing environment declarations, when for `.ts` files they currently do nothing. If someone later re-enables `no-undef` for typed files, or adds a globals-sensitive rule, this could resurface as a real gap that looks already-covered.
- Suggested fix: either note in the comment that these overrides are inert for typed `.ts` under the current strict-type-checked tier (kept for `.js`/`.mjs`/`.astro` siblings only), or drop the redundant `.ts` entries.
- Confidence: confirmed (reproduced via `eslint --print-config`).
- Owner decision needed: no.

#### TOOL-10: prettier's astroCompressHTML setting and Astro's compressHTML have no automated check keeping them in sync
- Severity: Low
- Category: correctness-risk
- Where: packages/tooling/src/prettier.config.mjs:20-26 (comment: "Keep this in step with compressHTML in astro.config.mjs")
- What: This is a manually-maintained invariant across two unrelated files (a consumer's `astro.config.mjs`, which doesn't have to live anywhere near the prettier config) with nothing enforcing it. Today it holds by coincidence: neither `site/astro.config.mjs` nor the blog's `astro.config.mjs` sets `compressHTML` explicitly, so both fall through to Astro 5's `true`/"html" default, matching the hardcoded `astroCompressHTML: "html"` here.
- Why it matters: if a future consumer (or this repo) ever sets `compressHTML: false`, formatted `.astro` files would silently drift into the wrong whitespace mode with no test catching it, since Prettier's job here is exactly the line structure this would corrupt.
- Suggested fix: low priority given today's coincidental alignment; if it's ever worth hardening, a consumer-side test asserting the two settings agree (similar in spirit to the existing prose-width test pattern) would close it.
- Confidence: likely (the coupling and its lack of enforcement are confirmed; the risk of actual drift is speculative since nothing sets `compressHTML: false` today).
- Owner decision needed: no.

#### TOOL-11: full peerDependencies list gives every partial adopter unmet-peer warnings
- Severity: Low
- Category: consistency
- Where: packages/tooling/package.json:30-42 (`peerDependencies` / `peerDependenciesMeta`)
- What: Only `puppeteer-core` is marked optional. `eslint`, `html-validate`, `stylelint`, `vitest`, and `prettier` are all required peers, even though a consumer could reasonably want only a subset (e.g. just the eslint+prettier presets, skipping stylelint/vitest/html-validate). Every partial adopter gets `npm warn` unmet-peer noise for tools they never intend to install. The one full adopter that exists today (the blog) does install all of them, so this hasn't bitten in practice yet.
- Why it matters: low impact (warnings, not failures), but it's the kind of noise that trains people to ignore real unmet-peer warnings.
- Suggested fix: consider `peerDependenciesMeta.optional` for `html-validate` and `vitest` at least, since those two presets/utilities are more separable from the "always use these together" eslint+stylelint+prettier core. This is a design call, not a clear defect.
- Confidence: likely.
- Owner decision needed: yes (it's a packaging-philosophy call, not a bug).

### Checked and fine
- `tsconfigRootDir: process.cwd()` (eslint.config.mjs:44): rationale in the comment matches actual behavior; confirmed the alternative (`import.meta.dirname`) would indeed break once shipped in a package, and `npm run lint:js` passes clean across the whole monorepo today, proving the current approach resolves correctly for at least the dogfooding case.
- All five eslint preset dependencies actually imported (`@eslint/js`, `typescript-eslint`, `eslint-plugin-astro`, `globals`, `@stylistic/eslint-plugin`) are correctly declared in `packages/tooling/package.json` dependencies, and versions are peer-compatible with the declared `eslint` peer range (verified against installed `eslint@10.9.1`, `typescript-eslint`, `eslint-plugin-astro`, `@stylistic/eslint-plugin` peer ranges).
- `prettier-plugin-astro` (imported by prettier.config.mjs) is correctly declared as a dependency and its own peer range (`prettier ^3.5.3`) is compatible with the declared `prettier` peer (`^3.9.6`).
- `curly: multi-line` and `no-nested-ternary` are genuinely active rules (verified with `eslint --print-config` against a real source file), matching the README's and CLAUDE.md's description of the owner's 2026-09-10 rules.
- The two stylelint rules that look suspiciously absent from `stylelint-config-standard`'s own index (`no-descending-specificity`, `selector-pseudo-class-no-unknown`) are in fact live, inherited from `stylelint-config-recommended` (which `-standard` extends) and deliberately reconfigured here, not dead overrides.
- `npm run lint:js` and `npm run lint:css` both pass clean across the whole monorepo as of this audit, confirming the dogfooded presets are currently healthy against real project files.
- `htmlvalidate.json` loads and validates correctly against the pinned peer `html-validate@9.7.1` (tested directly via the API), including the `valid-id: relaxed` option and the disabled rules (`void-style`, `no-trailing-whitespace`, `prefer-button`, `long-title`).
- jsdom's dialog polyfill guard (`typeof p.showModal !== "function"`) is correct: jsdom 29.1.1 (the pinned devDependency here) does not implement `HTMLDialogElement.prototype.showModal`/`close` at all, so the polyfill always installs as intended and won't silently no-op against a future jsdom that adds real support without a function-typed member.
- Windows vs POSIX kill strategy in `stopPreview` (`taskkill /T /F` vs `process.kill(-pid, "SIGTERM")` on a detached group) is internally consistent with the corresponding spawn options (`detached: process.platform !== "win32"`) for the case where a valid `ChildProcess` reference is actually obtained (the failure-path leak is TOOL-1, a separate issue from this pairing itself).
- No em dashes anywhere in `packages/tooling/` (house style, CLAUDE.md), confirmed by direct search.
- `--blink-settings` hover/pointer values in `launchChrome` are the same values already proven CI-green in production per the project record; not re-litigated here.
- Package `exports` map subpaths (`./eslint`, `./stylelint`, `./htmlvalidate`, `./prettier`, `./test-kit/*`) all point at files actually present under `files: ["src"]`, so nothing published is missing from the tarball.

## Appendix: OPS audit

Audited at `feat/popout` f1c55b7. Read-only; `npx tsc --noEmit -p` run for site, packages/astro, packages/css (all clean). No servers started, no installs.

### Findings

#### OPS-1: The OIDC publish token is available to every gate step, including dependency install scripts
- Severity: Medium
- Category: security
- Where: .github/workflows/release.yml:4-6 (workflow-level `id-token: write`), :18-21 (`npm ci`, `npm test`, `npm run lint`, `npm run build:site` in the same job as the publishes)
- What: `id-token: write` is granted to the single `publish` job, and that job also runs `npm ci` (lifecycle scripts of every dependency, e.g. `puppeteer`'s `hasInstallScript: true`, package-lock.json:8292-8297), vitest, eslint, stylelint and the Astro build. Any step in a job with `id-token: write` can request an OIDC token from the runner (`ACTIONS_ID_TOKEN_REQUEST_URL`/`TOKEN` are in the job env), and npm trusted publishing exchanges that token for a publish credential.
- Why it matters: a compromised transitive devDependency executing during the release's install or test phase could mint a token and publish under @half-built. The brief's least-privilege bar (id-token scoped only to publish) is not met in substance even though there is one job.
- Suggested fix: split into a `gates` job (permissions `contents: read` only) that runs install/test/lint/build, and a `publish` job with `needs: gates`, `permissions: { contents: read, id-token: write }`, that runs `npm ci --ignore-scripts` and the three `npm publish` steps only. Optionally a GitHub environment on the publish job for an approval gate.
- Confidence: likely (the mechanism is documented GitHub/npm behavior; not exploited here)
- Owner decision needed: no

#### OPS-2: A tag on any commit publishes; neither "from main only" nor tag == version is enforced
- Severity: Medium
- Category: correctness-risk
- Where: .github/workflows/release.yml:2-3 (`tags: ["v*"]`), :22-24; README.md:44 ("Publishing happens from `main` only"); site/test/release.test.ts:57-89 (checks shared version and bump, not the tag name)
- What: the trigger matches any `v*` tag on any commit. Nothing checks that the tagged commit is on `main`, or that `GITHUB_REF_NAME` equals `v` + the packages' version. A `v0.12.0` tag on a commit whose manifests still say an unpublished `0.11.1` would publish 0.11.1 under a v0.12.0 tag; a tag pushed from a feature branch (this clone sits on `feat/popout`, 15 commits past origin/dev, at 0.11.0 already) would publish unreviewed code.
- Why it matters: the release is irreversible on npm (versions cannot be reused), and the README states a rule the workflow does not hold.
- Suggested fix: a first step that fails unless `${GITHUB_REF_NAME#v}` equals each package version, and `git merge-base --is-ancestor $GITHUB_SHA origin/main` (needs `fetch-depth: 0`). Optionally a tag protection ruleset for `v*`.
- Confidence: confirmed (traced the workflow; no such check exists anywhere)
- Owner decision needed: no

#### OPS-3: The release does not run the browser suite, and nothing ties it to a green CI run
- Severity: Medium
- Category: test-gap
- Where: .github/workflows/release.yml:18-21 vs .github/workflows/ci.yml:27-42
- What: ci.yml's `browser` job (axe in both themes, the popout placement/sheet/keyboard contracts, footer island, palette head stamp) never runs on a tag, and release.yml does not run it or check the tagged commit's CI status. Tag pushes do not fire ci.yml (`branches: ["**"]` only).
- Why it matters: the checks that cover the newest, riskiest behavior (the Popout feature is almost entirely browser-tested) are advisory at release time. If a tag goes on a commit whose main-branch CI failed, or was never pushed as a branch, it publishes anyway.
- Suggested fix: add the browser job to release.yml as a prerequisite of the publish job (pairs with OPS-1's split), or have release call ci.yml via `workflow_call` and `needs:` it.
- Confidence: confirmed
- Owner decision needed: no

#### OPS-4: The build gate uses workspace links, so it cannot see packaging defects; two undeclared tooling deps are masked
- Severity: Medium
- Category: test-gap
- Where: package-lock.json:1351-1366 (`@half-built/*` are `"link": true` to packages/); site/README.md:3-7 ("if `site` builds, the packages work the way an external consumer would use them"); packages/tooling/src/stylelintrc.json:2 (`extends: ["stylelint-config-standard"]`) and :40-43 (`customSyntax: "postcss-html"`) vs packages/tooling/package.json dependencies/peerDependencies (neither listed); root package.json:105,109 (both present only as root devDeps)
- What: site resolves `@half-built/*` to the workspace source, not the packed tarball, and every root devDependency is hoisted beside it. So the gate never exercises the `files` list, and a preset that requires an undeclared module still passes. Concretely, `@half-built/tooling/stylelint` requires `stylelint-config-standard` and `postcss-html`, which the tooling package declares nowhere; a consumer who installs only the tooling package and its declared peers gets a stylelint "could not find" error. The blog works today only because it lists them itself (not verified in the blog repo).
- Why it matters: consumers other than the blog (BEADZ is the stated next one) hit a broken preset; the README overstates what the gate proves.
- Suggested fix: add both to tooling's `dependencies` (or peers, documented); add a CI step that runs `npm pack` for each package and a smoke install/lint in a temp dir outside the workspace, or at minimum `npm pack --dry-run` with a file-list assertion. Soften the site README sentence.
- Confidence: confirmed (the missing declarations); likely (consumer failure, by standard resolution)
- Owner decision needed: no

#### OPS-5: Release installs `npm@latest` unpinned and downloads Chrome it never uses
- Severity: Low
- Category: correctness-risk
- Where: .github/workflows/release.yml:17 (`npm install -g npm@latest`), :18 (`npm ci` without `PUPPETEER_SKIP_DOWNLOAD`, which ci.yml:22,36 sets)
- What: the publish toolchain floats to whatever npm is newest on release day (a new major could change publish or lockfile behavior mid-release; the history already records one npm@latest surprise with the lockfile). The `puppeteer` package in the lock (peer of @axe-core/puppeteer, `hasInstallScript: true`) downloads a Chrome build during every release install.
- Why it matters: a release can fail or behave differently for reasons unrelated to the code; the download adds time, a network dependency, and more install-script surface in the job holding id-token (OPS-1).
- Suggested fix: pin a major (`npm@11`, the trusted-publishing floor being 11.5.1), and set `PUPPETEER_SKIP_DOWNLOAD: "1"` on the release `npm ci` as ci.yml does.
- Confidence: confirmed
- Owner decision needed: no

#### OPS-6: A partial publish cannot be retried by rerunning the workflow
- Severity: Low
- Category: correctness-risk
- Where: .github/workflows/release.yml:22-24
- What: three sequential `npm publish` steps. If astro or tooling fails (registry hiccup, provenance error like v0.2.0's first attempt) after css succeeded, a rerun fails at the css step because 0.x.y is already taken, leaving the fixed-version set split on npm.
- Why it matters: recovery is a manual hand-publish, which is exactly what trusted publishing was meant to avoid.
- Suggested fix: skip a workspace whose version already exists (`npm view @half-built/css@$V version` guard before each publish), so a rerun resumes.
- Confidence: confirmed (by reading; not reproduced)
- Owner decision needed: no

#### OPS-7: Most browser tests hit the live ecosystem endpoint, and the suite leans on fixed sleeps
- Severity: Low
- Category: test-gap
- Where: site/test/browser.test.ts:105-131 (`open()` has no request interception; `networkidle0` waits on the live fetch), 179-211 (both full-page axe runs audit whatever the live document renders into the footer), 132-153 (`openPhone()` does not clear storage, unlike `open()`); fixed sleeps at 437, 568, 735, 747 (50/200/400 ms) and 862 (2500 ms)
- What: only the two footer tests block or stub `ecosystem.json`; the other ~25 tests fetch https://ecosystem.half-built-robots.com live, so the axe gates depend on another repo's data and on that host being up and quick. `openPhone()` inherits the previous test's localStorage (currently the island's cached document; a future test that saves a palette before the phone tests would silently change what the phone axe run audits). The short fixed sleeps after clicks and wheel events are the usual source of runner-speed flakes.
- Why it matters: a data-repo edit (say, a new entry label) or an endpoint outage can fail ui CI with no ui change; order-dependent state makes failures hard to reproduce.
- Suggested fix: abort or stub `ecosystem.json` in `open()`/`openPhone()` by default (the footer tests already show the pattern), give `openPhone()` the same `evaluateOnNewDocument` storage clear, and replace the sleeps with `waitForFunction` on the observed state.
- Confidence: confirmed (traced; no flake observed)
- Owner decision needed: no

#### OPS-8: Bump guard checks "differs from the newest tag", not "newer than it"
- Severity: Low
- Category: test-gap
- Where: site/test/release.test.ts:58-76
- What: the guard passes whenever the version is not equal to the newest tag's version. A branch cut before the latest release (still at an older, already-published version) sees its package dirs differ from the new tag and passes because the old number is "different". Also, at release time the checkout contains the release tag itself, so the guard compares the tree to itself and trivially passes (fine, but it means the guard adds nothing to release.yml; OPS-2 is the release-time check).
- Why it matters: the scenario the guard exists for (republishing a taken number) slips through on a stale branch.
- Suggested fix: compare semver: expect the manifest version to be greater than the tag's.
- Confidence: confirmed (by reading)
- Owner decision needed: no

#### OPS-9: Site README says Pages resolves the pins from the registry; the lockfile links the workspace
- Severity: Low
- Category: docs-truth
- Where: site/README.md:45-47; package-lock.json:1351-1358
- What: "the exact `@half-built/*` pins in `site/package.json` resolve on the registry only after the matching version tag publishes, so the release goes out before the first Pages build." With the lockfile's `link: true` entries, `npm ci` on Pages links packages/ and never consults the registry for them, so there is no ordering constraint (unless the site pin and the package version disagree, in which case the site would silently build against the old published version; see OPS-10).
- Why it matters: a reader follows an ordering rule that does nothing and misreads what the Pages build tests.
- Suggested fix: rewrite the bullet to say the site builds from the workspace source and the pins must equal the package version.
- Confidence: confirmed (lockfile); likely (Pages uses `npm ci`/the lockfile, per the README's own build settings)
- Owner decision needed: no

#### OPS-10: Nothing pins site/package.json's @half-built versions to the package version
- Severity: Low
- Category: test-gap
- Where: site/package.json:15-16,22; site/test/release.test.ts:86-89 (checks the three packages agree, not the site's pins)
- What: if a release bump updates the three manifests but not the site's three exact pins, npm stops linking the workspace and installs the previous published version from the registry. The site build and browser suite then test the old release while appearing green.
- Why it matters: the whole "site is the build gate" premise silently turns off.
- Suggested fix: one more assertion in release.test.ts that each `@half-built/*` entry in site/package.json equals the shared version.
- Confidence: likely (standard npm workspace resolution; not reproduced)
- Owner decision needed: no

#### OPS-11: ci.yml has no permissions block and double-runs on PR branches
- Severity: Low
- Category: security
- Where: .github/workflows/ci.yml:3-6
- What: no top-level `permissions:`, so `GITHUB_TOKEN` gets the repo default (write-all on older repos unless the setting was changed). `push: ["**"]` plus `pull_request` runs both jobs twice for every PR branch push. No `concurrency` or `timeout-minutes`.
- Why it matters: least privilege; doubled runner minutes; a hung Chrome burns the six-hour default.
- Suggested fix: `permissions: { contents: read }`; restrict `push` to `main`/`dev` (or drop `pull_request`); add `concurrency` with cancel-in-progress and a `timeout-minutes` on the browser job.
- Confidence: confirmed (file); the effective default depends on a repo setting I could not see
- Owner decision needed: no

#### OPS-12: Third-party actions pinned by tag, not commit SHA
- Severity: Low
- Category: security
- Where: .github/workflows/ci.yml:12,17,30,31; .github/workflows/release.yml:15,16
- What: `actions/checkout@v4` and `actions/setup-node@v4` are mutable tags; the release job runs them with `id-token: write`.
- Why it matters: a retagged action runs in the publish job. These are first-party GitHub actions, so the risk is small.
- Suggested fix: pin to full SHAs with a `# v4.x.y` comment, at least in release.yml.
- Confidence: confirmed
- Owner decision needed: yes (a policy call given no Dependabot to bump SHAs)

#### OPS-13: Live demo links to a page that does not exist
- Severity: Low
- Category: bug
- Where: site/src/pages/index.astro:168-175, 551-560 (built: `href="/2026/09/01/sample-published/"` in site/dist/index.html)
- What: the PostLink demo resolves `sample-published` to `/2026/09/01/sample-published/`, a real clickable link on ui.half-built-robots.com that 404s (the site has one page).
- Why it matters: a visitor clicking "the sample post" gets a 404; crawlers log it.
- Suggested fix: point the sample at an on-page anchor via the consumer's URL shape, or render it with a note that the target is illustrative; or add a tiny stub page at that path.
- Confidence: confirmed (link found in the built dist; no such route in site/src/pages)
- Owner decision needed: yes

#### OPS-14: The masthead ships a "Placeholder link" to example.com on the live site
- Severity: Low
- Category: consistency
- Where: site/src/data/site.ts:40-44
- What: the second social icon on the production masthead is labelled "Placeholder link" and goes to https://example.com.
- Why it matters: reads as unfinished on the public reference site; presumably there to demo a two-icon row.
- Suggested fix: replace with a real destination (the npm org page, the blog) or keep one icon.
- Confidence: confirmed
- Owner decision needed: yes

#### OPS-15: Stale references in configs and docs
- Severity: Low
- Category: docs-truth
- Where: packages/tooling/src/stylelintrc.json:8 (message cites `docs/css-architecture.md`, which does not exist in this repo; `docs/` holds only `superpowers/`); packages/astro/tsconfig.json:8 (includes `vitest.browser.config.ts`, which does not exist); site/README.md:3-5 (says the site consumes only `@half-built/css` and `@half-built/astro`; it also uses `@half-built/tooling`, site/package.json:22, and browser.test.ts:23-28 imports its test kit)
- What: three small truth drifts. The stylelint message is the one consumers see: it ships in the tarball and points every consumer at a file they do not have.
- Why it matters: a consumer's lint error names a nonexistent doc.
- Suggested fix: reword the message to state the rule (or point at packages/css/README.md); drop the tsconfig include; add tooling to the site README sentence.
- Confidence: confirmed
- Owner decision needed: no

#### OPS-16: No type-check gate
- Severity: Low
- Category: test-gap
- Where: .github/workflows/ci.yml:23-25; release.yml:19-21
- What: neither workflow runs `tsc --noEmit` or `astro check`. `astro build` strips types without checking, and vitest does not type-check. typescript-eslint's type-aware rules catch some classes of error, not type errors as such. All three projects type-check clean today (I ran them).
- Why it matters: a type regression in a shipped `.ts` file (the packages ship source, so consumers' tsc sees it) reaches npm.
- Suggested fix: add `tsc --noEmit -p packages/astro -p ...` (and optionally `astro check` for the .astro files) to the CI test job and the release gates.
- Confidence: confirmed
- Owner decision needed: no

### Checked and fine
- ci.yml uses `pull_request`, not `pull_request_target`; no `${{ github.event.* }}` or other untrusted input interpolated into any `run:` line in either workflow.
- release.yml fires only on `v*` tag pushes, never on a branch ref; `contents: read` is the only other permission; no npm token anywhere; provenance comes automatically from trusted publishing.
- CLAUDE.md's claim that tag pushes fire only release.yml holds (`branches: ["**"]` excludes tags); CI does run tests, lint (eslint, stylelint, Prettier check), and the site build as stated.
- Bump guard in shallow checkouts: ci.yml's test job uses `fetch-depth: 0`; the guard also does a best-effort `git fetch --tags` and skips cleanly with no tags; the browser job runs only browser.test.ts, which does not need tags.
- Package `repository` metadata pins (provenance) and the shared-version pin in release.test.ts match all three manifests (0.11.0).
- .githooks/pre-push correctly blocks `refs/heads/main` for any local ref (including `HEAD:main`), with the documented `ALLOW_MAIN_PUSH=1` escape.
- vitest.workspace.ts omits packages/tooling, which has no tests; the presets are exercised by the root lint dogfooding them.
- browser.test.ts is skipped without `BROWSER_TESTS=1`, so root `npm test` never needs Chrome; startPreview refuses a port someone else already serves (no stale-server reuse); stopPreview kills the process tree.
- CI Chrome: `--no-sandbox` only under `CI`, and the hover/pointer blink-settings lever is in launchChrome.
- Site third-party requests: fonts are self-hosted via @fontsource (bundled into `_astro/`), no Google Fonts, no analytics or beacons in source or dist; the only cross-origin fetch is the family's own ecosystem endpoint. The palette head script validates names and six-digit hex before setting properties.
- All in-page anchors used by NAV, the footer Site group, and the toc (`#intro`, `#frame`, `#cards`, `#components`, `#css`) exist in the built page; external links point at real repos/packages. The `#/page/N/` hrefs are inert pagination-demo placeholders.
- Root README and site README "live on Cloudflare Pages since 2026-09-07" statements are current (the earlier "no Pages project" staleness is fixed).
- `tsc --noEmit` passes for site, packages/astro, packages/css.
