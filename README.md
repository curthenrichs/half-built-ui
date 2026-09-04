# half-built-ui

A design system extracted from half-built-robots.com. It packages the
CSS, Astro components, and lint/test tooling that site runs on, so
other sites can use them.

## Packages

- `@half-built/css` - design tokens, base styles, patterns, and prose
  CSS.
- `@half-built/astro` - Astro components, islands, and helper functions.
- `@half-built/tooling` - shared lint presets (ESLint, Stylelint,
  html-validate) and a test kit.

`site/` is a kitchen-sink demo site, part of this workspace, that
consumes only the published packages and builds with `npm run
build:site`.

## Provenance

This code was extracted from the private
`half-built-robots-blog` repository, where it was built and used in
production. The extraction review that checked each piece for
blog-specific assumptions before it moved here is the design record for
this library. There is no separate design doc.

## Status

0.1.0 is unpublished. Nothing here has shipped to npm yet.
