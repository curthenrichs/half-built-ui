# @half-built/tooling

Lint presets and the test kit for half-built sites.

## Test kit

`test-kit/browser-server.ts` type-imports and dynamically imports
`puppeteer-core` for `launchChrome`; it is an optional peer dependency,
so consumers of the test kit install `puppeteer-core` themselves.

## Provenance

Extracted from the private `half-built-robots-blog` repository, where
this configuration was built and used in production. The extraction
review that checked it for blog-specific assumptions before the move is
the design record for this package.
