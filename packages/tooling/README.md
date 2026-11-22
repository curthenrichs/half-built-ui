# @half-built/tooling

Lint presets, the test kit, and the palette math for half-built sites.

## Presets

- `@half-built/tooling/eslint`: flat config for JS, TS (type-checked
  strict tier), and Astro, plus the vertical-whitespace policy: a
  blank line after imports and around interfaces, types, classes,
  functions, exports, and any statement that spans several lines, and
  braces on any control-statement body that drops to its own line
  (`curly: multi-line`). Autofixable with `eslint --fix`.
- `@half-built/tooling/stylelint`: stylelint-config-standard tuned for
  the house CSS (no hex outside tokens, no `ch` widths), with the
  empty-line rules on so rules and comment groups get their own air.
  Autofixable with `stylelint --fix`, except the `z-index` rule: new
  in 0.19.0, it limits `z-index` to `auto` or a `var(--z-*)` token.
  That is a breaking lint change and not autofixable, since a raw value
  needs a named rung chosen by hand; see the @half-built/css README,
  Stacking.
- `@half-built/tooling/prettier`: Prettier's defaults plus the Astro
  plugin. Prettier is a peer dependency; consumers import the preset
  from `prettier.config.mjs` and add `*.md` to `.prettierignore` if
  their prose should stay as written. `astroCompressHTML` is set to
  match Astro's own `compressHTML` default (`true`); a consumer that
  turns `compressHTML` off in `astro.config.mjs` must override
  `astroCompressHTML` to match, or the plugin reformats around
  whitespace the build no longer collapses.
- `@half-built/tooling/htmlvalidate`: html-validate cannot `extends` a
  package's JSON preset yet, so consumers keep a local copy of this
  file. Needs the optional `html-validate` peer.

Prettier keeps blank lines but never adds them, so run it first, then
the two linters' fixers, then Prettier once more to tidy what the
fixers rewrote. The workspace's `lint:fix` script is that sequence.

## Test kit

From `test-kit/browser-server.ts`:

- `findChrome()`: returns the absolute path to a local Chrome or
  Chromium install; throws naming every path it checked. `CHROME_PATH`
  overrides the search when set. The built-in candidates cover Windows,
  the ubuntu-latest CI runner, and macOS (Chrome and Chromium).
- `startPreview(port, readyPath)`: spawns `astro preview` on `port` and
  resolves once `readyPath` answers 200. Refuses to run against a port
  something else already answers. If the wait fails (a 404, a crashed
  server, or a timeout) it stops the server it just spawned before
  rethrowing, so a failed run never leaks a process holding the port.
- `stopPreview(server)`: kills the server and, on POSIX, its whole
  detached process group; safe to call on a server that never started.
- `launchChrome()`: launches headless Chrome with a stated desktop
  pointer (`hover`, fine `pointer`) so hover-gated code does not
  silently decline to mount on a CI runner with no input devices.
- `desktopPage(browser, width?, height?)`: opens a desktop-viewport
  page.
- `phonePage(browser, width?, height?)`: opens a touch, phone-viewport
  page, which flips `(hover: none)` and `(pointer: coarse)` on for that
  page over the launch setting.

From `test-kit/helpers.ts`:

- `stubRafOnFakeTimers()`: stubs `requestAnimationFrame` and
  `cancelAnimationFrame` on a self-advancing frame clock, for suites
  under `vi.useFakeTimers()`. Undo with `vi.unstubAllGlobals()`.
- `polyfillDialog()`: fills in `HTMLDialogElement.prototype.showModal`
  and `.close` where jsdom has not implemented them, so a suite
  exercises the component's logic rather than jsdom's gaps.
- `recordingContext()`: returns a `RecordingContext` whose `ctx` is a
  fake 2D canvas context recording every draw call (with the style
  fields in effect at call time) into `calls`, and whose `ops(op)`
  filters `calls` down to one operation.
- `CanvasCall`: the shape of one recorded canvas call (`op`, `args`,
  and the style snapshot).
- `RecordingContext`: the shape `recordingContext()` returns (`calls`,
  `ops`, `ctx`).

## Palette

`@half-built/tooling/palette` is the accent-palette math behind the
reference site's palette editor. A consumer's build can use it to
derive a compliant override from two base colors and to assert the
contrast of whatever it ships. It is pure functions with no DOM, so
it also runs in a browser bundle (the editor imports it that way).

- `derivePalette(base1, base2)`: the full override for two accent
  bases: both brand ramps plus the code island's chrome, each stop
  walked in OKLCH until it clears its WCAG gate against the ground it
  renders on. The shipped amber pair returns the package's own tokens
  exactly.
- `readBases(base1, base2)`: the bases' own ratios and pass flags (as
  text on the dark ground, as a fill on light paper, and for base 1,
  as code keyword ink on its derived code ground).
- `overrideBlock(palette)`: the override as a ready-to-paste `:root`
  block, in `RAMP_ORDER`.
- `contrastRatio(a, b)`: the WCAG 2.x ratio between two CSS colors,
  through culori's `wcagContrast`; throws on a string culori cannot
  parse.
- `RAMP_ORDER`, `SHIPPED_B1`, `SHIPPED_B2`, and the grounds the gates
  are measured against (`LIGHT_PAPER`, `DARK_GROUND`, `CODE_GROUND`,
  and the code chrome references). The package's tests pin every
  ground and shipped stop to `@half-built/css`'s tokens, so they move
  together.
- Types: `PaletteOverride`, `BaseReadout`, `Base1Readout`.

The module ships as TypeScript source with `.ts` import specifiers,
like the test kit: Vite and Astro load it as is, and so does Node
with type stripping (on by default from 22.18).

## Browser support floor

The packages support Chrome 99, Edge 99, Firefox 98, and Safari 15.4
on macOS and iOS (early 2022). Below that, `@layer` is missing and
every layered rule drops, and the modals' `<dialog>` is missing in
Firefox 97. The floor is recorded once, in
`@half-built/tooling/browser-floor` (a JSON map of web-features browser
ids to versions).

The stylelint preset enforces it with `stylelint-plugin-use-baseline`
at `available: 2021`, a bucket entirely below the floor, so anything
newer is reported. The features between that bucket and the floor are
allowlisted in the preset. Each one is either supported at the floor
(the package tests check its support data against `browser-floor`),
degrades harmlessly below it, or is compiled away at build time. To
allow a new feature, add it to the preset's ignore lists and add a row
to the allowlist table in `test/stylelint-baseline.test.ts`; the test
fails if either side is missing. A one-off use that degrades harmlessly
can take a `stylelint-disable-next-line plugin/use-baseline` comment
with its reason instead.

`color-mix()` and the dynamic viewport units (`dvh`, `svh`, `lvh`) are
newer than the floor but fine to use with a fallback, so the preset's
own rule, `half-built/require-fallback`, checks them instead: the
declaration must come straight after a plain declaration of the same
property (`min-height: 100vh; min-height: 100dvh;`), or sit inside an
`@supports` block that tests the same feature. A browser that drops the
new value keeps the old one. Custom properties are exempt, since the
declaration that reads them is the one checked.

## Requirements

Node `^22.13.0 || >=24`. Required peers: `eslint`, `stylelint`,
`prettier`. Optional peers: `html-validate` (the `htmlvalidate`
preset) and `vitest` (the test kit). The test kit's browser helpers
also need `puppeteer-core`, installed by the consumer and tested with
25.x. It is not declared as a peer: npm walks optional peers when it
resolves, and html-validate's chain (vitest, @vitest/browser,
webdriverio) caps puppeteer-core at 24.x, so declaring 25.x made a
fresh install fail with ERESOLVE.

## Provenance

Extracted from the private `half-built-robots-blog` repository, where
this configuration was built and used in production. The decisions
behind it are in the [design record](https://github.com/curthenrichs/half-built-ui/blob/main/docs/design-record.md).
