# CLAUDE.md

Guidance for Claude Code when working in this repo. `README.md` is for
people: the package map, provenance, and release rules. This file is
the rules for working here.

## What this is

The half-built design system, extracted from half-built-robots.com and
published on npm as `@half-built/css`, `@half-built/astro`, and
`@half-built/tooling` (0.1.0 since 2026-09-04). An npm-workspaces
monorepo; `site/` is a private kitchen-sink demo that consumes only
the published package specifiers and is the build gate. The blog is
the reference consumer; BEADZ adopts later. The full design record is
the extraction review in the blog repo
(`half-built-robots-blog/docs/superpowers/reviews/2026-08-24-library-extraction-review.md`).

## Boundaries

- Henry never enters this repo in any form: no artwork, no engine, no
  file whose name contains henry. Branded marks stay site-side in the
  consumers; the package's default glyphs are Lucide (ISC, see
  `packages/astro/ICONS-LICENSE`, which ships in the tarball).
- Nothing here reads a consumer's content, config values, or voice.
  A component that needs site data takes it as typed props (see
  `packages/astro/src/components/models.ts`). If a change seems to
  need blog-specific knowledge, it belongs in the blog, not here.
- Design rules are set from the blog; BEADZ is a prototype and is not
  a source of values or design authority. Tune new values for the
  blog's accessibility gates (WCAG AA).
- The demo site uses neutral sample data and geometric placeholder
  SVGs, never blog content or photos.

## Workflow and releases

- Day-to-day work folds into `dev`; `main` moves by deliberate merge.
  The committed `.githooks/pre-push` refuses direct pushes to main
  (activate per clone: `git config core.hooksPath .githooks`; escape:
  `ALLOW_MAIN_PUSH=1`).
- Releases: merge to main, bump the fixed version across all three
  packages, tag `vX.Y.Z`, push the tag. `release.yml` runs the gates
  and publishes via npm trusted publishing (OIDC, no tokens,
  provenance automatic). No changesets, no version bots, no
  Dependabot; consumers bump their exact pins by hand.
- Consumers never patch `node_modules`: a defect found downstream is
  fixed here, released as a patch, and the consumer bumps its pin.
- CI (`ci.yml`) runs tests, the tooling preset lint, and the site
  build on branch pushes; tag pushes fire only `release.yml`.

## House style

- No em dashes anywhere: code comments, docs, READMEs.
- eslint (the package's own preset, dogfooded via the root
  `eslint.config.mjs`) forbids non-null assertions and String.match
  where RegExp.exec works. `npx eslint .` must stay clean.
- Package READMEs ship in the tarballs; keep them truthful, and
  remember edits reach npm only at the next publish.

## Consumer notes (learned at the blog swap)

- Wildcard subpath imports need explicit extensions under tsc bundler
  mode: `@half-built/astro/lib/slug.ts`, `.../components/Shell.astro`.
- `Masthead.astro` is an exports alias for `SiteHeader.astro`.
- html-validate cannot `extends` the package's JSON preset (upstream
  import-attribute gap); consumers keep a local copy of
  `htmlvalidate.json`.
- The css breakpoints are `@custom-media`; consumers wire
  postcss-custom-media plus postcss-global-data fed the breakpoints
  file (recipe in `packages/css/README.md`).

## History

The 11.3 move was verbatim from the blog, proven byte-identical by a
manifest-driven verify-move gate that retired once the blog swapped
onto the published packages; both live in git history. Future work
here is normal library development, gated by the suites, the demo
build, and the blog's parity discipline at each pin bump.
