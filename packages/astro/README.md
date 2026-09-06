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

## Import notes

Wildcard subpath imports need explicit file extensions under
TypeScript's bundler mode: `@half-built/astro/lib/slug.ts` and
`@half-built/astro/components/Shell.astro`, not extensionless forms.
Vite resolves either; `tsc --noEmit` only accepts the explicit one.

The `Masthead.astro` export is an alias for `SiteHeader.astro`, the
same component under its public name.
