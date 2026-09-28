# half-built-ui

A design system extracted from half-built-robots.com. It packages the
CSS, Astro components, and lint/test tooling that site runs on, so
other sites can use them.

## Packages

- `@half-built/css` - design tokens, base styles, patterns, and prose
  CSS.
- `@half-built/astro` - Astro components, islands, and helper functions.
- `@half-built/tooling` - shared lint and format presets (ESLint,
  Stylelint, Prettier, html-validate) and a test kit.

`site/` is a kitchen-sink demo site, part of this workspace, that
consumes only the published packages and builds with `npm run
build:site`. `npm run typecheck` runs `tsc` over every project, then
`astro check` on the site.

## Provenance

This code was extracted from the private
`half-built-robots-blog` repository, where it was built and used in
production. The extraction review that checked each piece for
blog-specific assumptions before it moved here is the design record for
this library. There is no separate design doc.

## Status

First published to npm on 2026-09-04; the version tags carry the
release history. half-built-robots.com consumes
all three packages from the registry as the reference consumer.
Releases follow the Release rules below. The reference site with a
live palette editor lives in `site/` (see `site/README.md`) and is
live at ui.half-built-robots.com, deployed from `main` by Cloudflare
Pages since 2026-09-07.

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
pushing the tag. The `release` workflow runs the full CI, browser
suite included, then checks that the tag equals every package's
version and that the tagged commit is on `main`, and only then
publishes over OIDC, with no npm token stored anywhere. Only the
publish job can mint the credential, and it installs none of the
repo's dependencies. A release that fails partway can be rerun: a
version npm already has is skipped. There is no version automation.
Bumping the version in each package's `package.json` is a manual
step before tagging.

A tag that fails verify (wrong version, or not on main) is deleted
locally and on the remote, then the fix lands and the tag is pushed
again. Once any package of a version is on npm, never move that
version's tag: fix forward with the next patch version instead (npm
keeps the first upload, and a moved tag would rerun green while
publishing nothing new).
