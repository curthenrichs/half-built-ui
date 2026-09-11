# @half-built/tooling

Lint presets and the test kit for half-built sites.

## Presets

- `@half-built/tooling/eslint`: flat config for JS, TS (type-checked
  strict tier), and Astro, plus the vertical-whitespace policy: a
  blank line after imports and around interfaces, types, classes,
  functions, exports, and any statement that spans several lines.
  Autofixable with `eslint --fix`.
- `@half-built/tooling/stylelint`: stylelint-config-standard tuned for
  the house CSS (no hex outside tokens, no `ch` widths), with the
  empty-line rules on so rules and comment groups get their own air.
  Autofixable with `stylelint --fix`.
- `@half-built/tooling/prettier`: Prettier's defaults plus the Astro
  plugin. Prettier is a peer dependency; consumers import the preset
  from `prettier.config.mjs` and add `*.md` to `.prettierignore` if
  their prose should stay as written.
- `@half-built/tooling/htmlvalidate`: html-validate cannot `extends` a
  package's JSON preset yet, so consumers keep a local copy of this
  file.

Prettier keeps blank lines but never adds them, so run it first, then
the two linters' fixers, then Prettier once more to tidy what the
fixers rewrote. The workspace's `lint:fix` script is that sequence.

## Test kit

`test-kit/browser-server.ts` type-imports and dynamically imports
`puppeteer-core` for `launchChrome`; it is an optional peer dependency,
so consumers of the test kit install `puppeteer-core` themselves.

## Provenance

Extracted from the private `half-built-robots-blog` repository, where
this configuration was built and used in production. The extraction
review that checked it for blog-specific assumptions before the move is
the design record for this package.
