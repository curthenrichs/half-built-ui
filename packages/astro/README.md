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

## WhenPublished and PostLink

`content/WhenPublished.astro` renders its children only when the post
at `slug` is visible, so a published post can tease one still in
draft and the passage appears on its own when the target ships.
`content/PostLink.astro` links to a post by slug and resolves the
href at build time through `postPath`, so a re-dated post does not
strand the links pointing at it. Both take the consumer's collection
as the `posts` prop (the full collection, drafts included, so an
unknown slug can throw instead of hiding as "still a draft");
`WhenPublished` also takes the consumer's draft gate as `showDrafts`,
and `PostLink` accepts an optional `tip` carried as `data-tooltip` for
the link-tip island. A consumer wraps each in a one-line site
component that injects `getCollection` and its own gate, the way the
blog does. The resolvers live in `lib/drafts.ts` for consumers that
want the logic without the components.

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
The table's scroll box is a keyboard tab stop named by the `label`
prop (default "Palette"), since the table scrolls sideways below the
column's width.

## Ecosystem island

`scripts/ecosystem` fills the Footer's Ecosystem column from a shared
JSON document, so adding a property to a family of sites does not mean
rebuilding every one of them.

```js
import { mountEcosystem } from "@half-built/astro/scripts/ecosystem";

void mountEcosystem(document, {
  endpoint: "https://example.com/ecosystem.json",
  selfKey: "ui",
});
```

The endpoint is a parameter and the package ships no default. `Footer`
keeps taking `ecosystem` and `ecosystemSelf` as typed props, and those
props are the static baseline the island replaces. Every failure path
leaves that baseline standing: no JavaScript, a dead endpoint, a
malformed payload, or a document that does not contain `selfKey`.

The document is `{ version: 1, entries: [...] }` where each entry has
`key`, `label`, `href` (null renders unlinked), `priority` (ascending,
0 highest) and `family`. Entries are sorted with the self entry's own
family first, then by priority, and capped at `limit`, default 6.

## Footer reserve for bottom-docked controls

A control cluster fixed to the viewport's bottom corner takes no room
in flow, so the page's last lines end underneath it. Set the css
package's `--dock-bottom` token to the room the cluster occupies
(its height, inset, and air) and `Footer` pads its band by that much
below the last link, so the page scrolls far enough to clear the
cluster. The token is `0px` by default and can be set inside the same
media block that pins the cluster.

## Search flyout

`scripts/site-header` drives the masthead's search flyout as a
disclosure: the magnifier toggles it open and closed, opening moves
focus to the field, Escape closes and returns focus to the magnifier,
and a press or keyboard focus leaving the flyout closes it. The island
marks the wrap `data-search-js`; without it, the stylesheet's
focus-within rule opens the flyout on focus alone, so it still works
with no script.

## Import notes

Wildcard subpath imports need explicit file extensions under
TypeScript's bundler mode: `@half-built/astro/lib/slug.ts` and
`@half-built/astro/components/Shell.astro`, not extensionless forms.
Vite resolves either; `tsc --noEmit` only accepts the explicit one.

The `Masthead.astro` export is an alias for `SiteHeader.astro`, the
same component under its public name.
