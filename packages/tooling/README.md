# @half-built/tooling

Lint presets and the test kit for half-built sites.

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
  Autofixable with `stylelint --fix`.
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
this configuration was built and used in production. The extraction
review that checked it for blog-specific assumptions before the move is
the design record for this package.
