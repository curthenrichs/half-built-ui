# @half-built/astro

Astro components, islands, and pure helpers for the half-built design
system.

## Provenance

Extracted from the private `half-built-robots-blog` repository, where
these components were built and used in production. The extraction
review that checked them for blog-specific assumptions before the move
is the design record for this package.

## Icons

Default icon glyphs are derived from Lucide (https://lucide.dev), ISC
license. See `ICONS-LICENSE`.

## EditorNote

`content/EditorNote.astro` is a reminder block for content that must
not ship: by default it renders only when the consuming build runs in
dev mode, and a deploy build emits nothing for it. A consumer with a
wider preview concept (the blog's SHOW_DRAFTS builds, for example)
passes its own gate through the `shown` prop; the component reads no
consumer config itself.

## Live code colors

`shiki/code-theme` bakes its amber values into every highlighted span
at build time. `shiki/code-vars` is a Shiki transformer that rewrites
those baked values to the css package's `--code-token-*` and
`--code-*` custom properties, so highlighted code follows a runtime
palette override. The variables resolve to the same hexes the theme
bakes, so adopting the transformer changes no rendered pixel on its
own. Pass it beside the theme: the `transformers` prop of
`astro:components`' `Code`, or `markdown.shikiConfig.transformers` in
an Astro config.

## Palette token entries

A `content/Palette.astro` entry may carry `token` (a custom property
name) instead of `hex`: the swatch then paints `var(token)` and
follows the live cascade with no script, and the hex cell renders
empty with a `data-token-hex` attribute for a consumer script to fill
from computed styles. Entries with `hex` render exactly as before.

## Import notes

Wildcard subpath imports need explicit file extensions under
TypeScript's bundler mode: `@half-built/astro/lib/slug.ts` and
`@half-built/astro/components/Shell.astro`, not extensionless forms.
Vite resolves either; `tsc --noEmit` only accepts the explicit one.

The `Masthead.astro` export is an alias for `SiteHeader.astro`, the
same component under its public name.
