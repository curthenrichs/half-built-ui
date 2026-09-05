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

0.1.0 published to npm on 2026-09-04. half-built-robots.com consumes
all three packages from the registry as the reference consumer.
Releases follow the Release rules below. A reference site with a live
palette editor lives in `site/` (see `site/README.md`); it deploys
from `main` once its Cloudflare Pages project exists, which it does
not yet.

## Release rules

Work folds into `dev`. `main` moves only by a deliberate merge from
`dev`. A committed pre-push hook guards `main` against accidental
pushes. Activate it once per clone with `git config core.hooksPath
.githooks`. A deliberate push to `main` needs `ALLOW_MAIN_PUSH=1`.

Publishing happens from `main` only, by pushing a tag. One tag per
version, in the form `vX.Y.Z`. All three packages share that version
number and move together, so a release always bumps `@half-built/css`,
`@half-built/astro`, and `@half-built/tooling` to the same value even
if only one package changed.

The first publish is run by hand, because it sets up npm's trusted
publishing for this repository. Every release after that happens by
pushing the tag. The `release` workflow builds and publishes over
OIDC, with no npm token stored anywhere. There is no version
automation. Bumping the version in each package's `package.json` is a
manual step before tagging.
