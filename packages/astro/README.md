# @half-built/astro

Astro components, islands, and pure helpers for the half-built design
system.

## Provenance

Extracted from the private `half-built-robots-blog` repository, where
these components were built and used in production. The extraction
review that checked them for blog-specific assumptions before the move
is the design record for this package.

## Icons

Every glyph the package draws comes from one registry,
`scripts/core/icons.ts`, derived from Lucide (https://lucide.dev), ISC
license; see `ICONS-LICENSE`. Templates render one through
`components/Icon.astro`:

```astro
<Icon name="search" size={14} />
```

`name` is a registry key (`x`, `play`, `sparkles`, `pause`,
`rotate-ccw`, `chevron-left`, `chevron-right`, `chevron-up`,
`arrow-left`, `arrow-right`, `sun`, `moon`, `search`, `clock`, `user`,
`calendar`, `circle`), `size` a CSS
length or pixel count (default `1em`, tracking the parent's font
size), `strokeWidth` defaults to 2.5, and `class` lands on the svg.
The icon is decorative by contract (aria-hidden, pointer-events none),
so the accessible name belongs to the button or link around it. The
svg arrives through `set:html` and carries no scoped-style attribute;
style it from the parent with `:global(svg)`. Client scripts take the
`ICON_*` strings from the same file. Add a glyph to the registry,
never as inline `<svg>` in a component; a test enforces that.

## Corner badges

`CornerBadges.astro` takes its chips as data, `badges: Badge[]` from
`scripts/core/badges.ts`: a `key` (rendered as the `badge-<key>` class,
the styling hook), a `label`, and an `icon` name from the registry.
The two house conventions ship as `GENAI_BADGE` and `DEMO_BADGE`; a
site's view-model lists the badges a post carries, in order, and can
add its own without a package change. `PostCardModel.badges` carries
them to the card. The content components (`BlogImage`, `GalleryImage`,
`MediaText`) take the same `badges` array, for example
`badges={[GENAI_BADGE]}` with `GENAI_BADGE` imported from
`@half-built/astro/scripts/core/badges.ts`.

## EditorNote

`content/EditorNote.astro` is a reminder block for content that must
not ship: by default it renders only when the consuming build runs in
dev mode, and a deploy build emits nothing for it. A consumer with a
wider preview concept (the blog's SHOW_DRAFTS builds, for example)
passes its own gate through the `shown` prop; the component reads no
consumer config itself.

## WhenPublished and PostLink

`content/PostLink.astro` links to a post by slug and resolves the
href at build time through `postPath`, so a re-dated post does not
strand the links pointing at it. While the target is hidden (a draft, with the
draft gate off) it renders its text alone, with no element and no
styling, and becomes a link on its own when the post ships. That makes
it the right tool for a draft's name in published prose.

`content/WhenPublished.astro` renders its children only when the post
at `slug` is visible. Use it when a whole phrase only makes sense once
the post exists ("its own post", "see it here"). An optional `fallback`
slot renders while the target is hidden:

```mdx
<WhenPublished slug="my-draft">
  It has <PostLink slug="my-draft">its own post</PostLink> now.
  <Fragment slot="fallback">A post on it is coming.</Fragment>
</WhenPublished>
```

Both take the consumer's collection as the `posts` prop (the full
collection, drafts included, so an unknown slug can throw instead of
hiding as "still a draft") and the consumer's draft gate as
`showDrafts`. `showDrafts` defaults to false, so a preview build must
pass its own draft gate through to `PostLink` to keep draft links
live. `PostLink` also accepts an optional `tip` carried as
`data-tooltip` for the link-tip island; a hidden `PostLink` drops it. A
consumer wraps each in a one-line site component that injects
`getCollection` and its own gate, the way the blog does. The resolvers
(`postLinkHref`, `resolvePostHref`, `forwardLinkVisible`) live in
`lib/drafts.ts` for consumers that want the logic without the
components.

## Derived excerpts

Posts carry no excerpt frontmatter. `lib/excerpt.ts` derives the card
text from the post body at build time: the opening prose, consecutive
paragraphs joined by a space, cut at a word boundary within
`EXCERPT_LIMIT` (200 characters) and always ended with an ellipsis,
the reader's cue that the post continues. The run stops at the first
heading, list, blockquote, code fence, or image line, so a card never
crosses into a later section; components and the lead-break are
invisible to it. `content/ExcerptStart.astro` on its own line moves
the start to the paragraph after it, for a post that opens on a TL;DR
or an aside. `postExcerpt(entry)` is the policy: a published post
with no prose fails the build naming the slug, a draft warns once per
build and renders blank. It takes any entry shaped
`{ body?, data: { slug, draft? } }`, so a `CollectionEntry` passes
with no cast. A consumer calls `postExcerpt` from every place a
summary renders (cards, meta description, feed, search index) and
never stores the result. The blog is the reference consumer and
derives all four from it. The rule was settled on the blog's 54 posts
on 2026-09-13 and moved here on 2026-09-14.

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
import { mountEcosystem } from "@half-built/astro/scripts/ecosystem.ts";

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

## TwoColumn

`components/TwoColumn.astro` renders its main column as `<main>`; pass
`mainTag="div"` for a demo or nested use where the page already has
its own main.

## Search flyout

`scripts/site-header` drives the masthead's search flyout as a
disclosure: the magnifier toggles it open and closed, opening moves
focus to the field, Escape closes and returns focus to the magnifier,
and a press or keyboard focus leaving the flyout closes it. The island
marks the wrap `data-search-js`; without it, the stylesheet's
focus-within rule opens the flyout on focus alone, so it still works
with no script.

## Lightbox

`scripts/lightbox` opens the images the content components link
through `LightboxLink` (`BlogImage`, `GalleryImage`, `MediaText`,
`Step`) in a full-window viewer. Links inside one `Gallery` or
`Walkthrough` form a set with previous and next buttons, thumbnails,
and the arrow keys.

```js
import "@half-built/css/plate-modal.css";
import "@half-built/css/lightbox.css";
import { mountLightbox } from "@half-built/astro/scripts/lightbox.ts";

mountLightbox(document);
```

The image opens at fit: contained in the window, very tall images fit
to width, and small images never scale past 100%. The wheel or a
trackpad zooms under the pointer in proportion to the scroll; a
sideways scroll does nothing. `+` and `-` step the zoom, `0` returns to fit, and a drag pans. Once
the image is panned mostly out of view a HOME box appears that also
returns to fit. Double-click at the fit view
zooms to 100% under the cursor; anywhere else it returns to fit.

A resize or rotation while the viewer is open refits the image to the
new window. Any zoom and pan the reader had set is discarded, on
purpose: the old view was measured against a window that no longer
exists.

`mountLightbox` takes options: `selector` (default `a.lightbox-link`)
picks the links, `groupSelector` names the containers whose links form
one set, and `labels` renames the viewer's controls for a site that is
not in English.

## Popout

`components/Popout.astro` puts a short note behind a table cell: detail
worth keeping but not worth a column. It renders a trigger button and a
template holding its slot; `scripts/popout` opens the note. Like
link-tip, the mounted island is a document-wide singleton: `root` only
names the document, and triggers anywhere in it share the one surface.

```astro
<Popout label="Sample row · Sample product">
  A short note with a <a href="#">link</a> and <code>code</code>.
</Popout>
```

```js
import "@half-built/css/popout.css";
import { mountPopouts } from "@half-built/astro/scripts/popout.ts";

mountPopouts(document);
```

`label` is required. It captions the open note and names the trigger
for assistive tech (`<trigger>: <label>`, so `Note: <label>` by
default), so write it to identify the row. `trigger` changes the button
text from `Note`. The slot takes inline markup: links, code, emphasis.

Above the phone breakpoint the note opens below its trigger (above it
when there is no room below) and stays until Escape, the close box, a
press outside, or another trigger. It also closes by itself when its
trigger scrolls out of view or when keyboard focus leaves it. Shift+Tab
off its first stop returns to the trigger; Tab off its last stop moves
on to whatever follows the trigger. On a wide touch device a
drag that starts outside the note closes it. At phone width it opens as
a modal bottom sheet that closes on the close box, Escape or Back, a
tap on the backdrop, or a downward swipe. One note is open at a time.
With JavaScript off the trigger does nothing.

A resize or rotation that crosses the phone breakpoint, in either
direction, closes an open note instead of turning the box into a sheet
or the sheet into a box. The reader reopens it and it opens in the mode
for the new width. Focus is not moved back to the trigger, which may
have scrolled away in the new layout. Resizes that stay on one side of
the breakpoint keep the note open: the box re-places itself, and the
sheet rides out the URL bar collapsing and the keyboard opening.

`mountPopouts` takes options: `selector` (default `.popout-trigger`)
picks the triggers, `edge` sets the anchored note's room against the
viewport edges in px, and `closeLabel` (default `Close`) names the
close box for a site that is not in English.

Not covered yet: structured content (lists, sub-tables, images),
triggers on chart marks, and hover previews.

## Import notes

Wildcard subpath imports need explicit file extensions under
TypeScript's bundler mode: `@half-built/astro/lib/slug.ts` and
`@half-built/astro/components/Shell.astro`, not extensionless forms.
Vite resolves either; `tsc --noEmit` only accepts the explicit one.

The `Masthead.astro` export is an alias for `SiteHeader.astro`, the
same component under its public name.
