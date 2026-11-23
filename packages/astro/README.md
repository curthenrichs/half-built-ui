# @half-built/astro

Astro components, islands, and pure helpers for the half-built design
system.

## Provenance

Extracted from the private `half-built-robots-blog` repository, where
these components were built and used in production. The decisions
behind them are in the [design record](https://github.com/curthenrichs/half-built-ui/blob/main/docs/design-record.md).

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
`calendar`, `circle`, `maximize-2`), `size` a CSS
length or pixel count (default `1em`, tracking the parent's font
size), `strokeWidth` defaults to 2.5, and `class` lands on the svg.
The icon is decorative by contract (aria-hidden, pointer-events none),
so the accessible name belongs to the button or link around it. The
svg arrives through `set:html` and carries no scoped-style attribute;
style it from the parent with `:global(svg)`. Client scripts take the
`ICON_*` strings from the same file. Add a glyph to the registry,
never as inline `<svg>` in a component; a test enforces that.

## Links that open a new tab

`NavItem` (the header's nav) and `SitemapLink` (the footer's sitemap
groups) take an optional `newTab: boolean`. When true the link renders
`target="_blank" rel="noopener"` and a visually hidden
` (opens in a new tab)` inside the link, so the cue reaches screen
readers. Without it the markup is unchanged.

## Corner badges

`CornerBadges.astro` takes its chips as data, `badges: Badge[]` from
`scripts/core/badges.ts`: a `key` (rendered as the `badge-<key>` class,
the styling hook), a `label`, and an `icon` name from the registry.
The three house conventions ship as `GENAI_BADGE` (a generated
image), `DEMO_BADGE` (an interactive demo), and `GUEST_BADGE` (a post
by a guest author rather than the site's owner; the site decides who
counts as a guest). A site's view-model lists the badges a post
carries, in order, and can add its own without a package change.
`PostCardModel.badges` carries them to the card. The content components (`BlogImage`, `GalleryImage`,
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

## AuthorBox

`components/AuthorBox.astro` credits the author of a post, typically a
guest's. Props are an `AuthorModel` (`name`, `url`, `bio`, typed in
`components/models.ts`) plus an optional `label`, which defaults to
"About the author". `url` is rendered exactly as given, so a relative
path to an about page and an absolute link to another site both work.
The markup hooks are `aside.author-box`, `.author-box-label`,
`.author-box-name` (the link), and `.author-box-bio`. The box is a
landmark named by its label and the author's name ("About the author
Sam Rivera"), so boxes for two different authors on one page keep
distinct accessible names. Its ids derive from `name`; a name with no
Latin letters or digits falls back to `author-box-author`, so two such
authors on one page would share ids.
Long names and bios wrap inside the box.

A guest post pairs it with the guest badge on the post's card:

```astro
---
import AuthorBox from "@half-built/astro/components/AuthorBox.astro";
---

<AuthorBox name="Sam Rivera" url="https://example.com/" bio="Short bio." />
```

with `badges: [GUEST_BADGE]` in that post's `PostCardModel`
(`GUEST_BADGE` from `@half-built/astro/scripts/core/badges.ts`).

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
an Astro config. It also encodes the `>` that Shiki's HTML serializer
leaves raw in `Code` output, so that output passes the tooling
html-validate preset.

## Footnote separators

`rehype/footnote-separators` is a rehype plugin for Markdown
footnotes. remark-gfm renders each `[^n]` as its own superscript, so
stacked references like `[^1][^2][^3]` run together as "123". The
plugin puts an `aria-hidden` superscript comma between references
that touch (whitespace counts as touching) and leaves references
split by prose alone. That check needs the text between them, which a
CSS sibling selector cannot see, so it lives in the markup. Add it to
`markdown.rehypePlugins` in an Astro config; MDX inherits it.

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

## SiteHeader title slot and search

`SiteHeader` (also exported as `Masthead`) has a named `title` slot
inside the home link. Fill it to replace the site name's text while
keeping the package's centering, boxed tagline, and h1/p choice:

```astro
<Masthead siteName="Sample Site" ...>
  <span slot="title" class="wordmark">Sample <em>Site</em></span>
</Masthead>
```

The span's own class carries any font change. `siteName` stays
required and is the fallback when the slot is empty.

`searchAction` defaults to `"/search/"`. Pass `searchAction={false}` to
render no search block at all (no button, flyout, or form). The phone
theme toggle stays.

The header wrapper does not form a stacking context, so the open
mobile menu and the search flyout compete at their own rung
(`--z-search-flyout`) and paint over a consumer's fixed layers on
lower rungs.

## Search flyout

`scripts/site-header` drives the masthead's search flyout as a
disclosure: the magnifier toggles it open and closed, opening moves
focus to the field, Escape closes and returns focus to the magnifier,
and a press or keyboard focus leaving the flyout closes it. The island
marks the wrap `data-search-js`; without it, the stylesheet's
focus-within rule opens the flyout on focus alone, so it still works
with no script.

## Image loading state

`SmartImage` renders its image inside a `<span class="img-frame">` and
mounts `scripts/image-loading`. While the image downloads, the frame
carries `data-loading`: it shows the `.bracket-frame` look on the
`--band` ground with a centered `$> Loading...` label, the prompt in
`--accent-1-ink` and the rest in `--ink-muted`, and the dots step from
none to three. The image stays transparent, so the browser never draws
its alt text. On `load` or `error` the mark clears and the image fades
in; a broken image then shows its alt text. Reduced motion holds the
label at three dots. The styles are the `img-loading` pattern in
`@half-built/css/patterns.css`.

The script sets the mark, never the server, so without JS an image
renders exactly as a bare `<img>`. The mark waits a 150ms grace period
(`LOADING_GRACE_MS`), so an image that is already loaded or arrives from
cache never shows the state, and the label leaves the DOM once its
0.35s fade-out ends (`LOADING_FADE_MS`). `watchImage(frame, img)` and
`buildLoadingLabel(doc)` are exported for other image surfaces; the
lightbox uses `watchImage` on its viewbox.

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

When the viewer's current item has not loaded yet (it was opened
before the in-page image loaded, or stepped to one that has not), the
viewbox shows the same loading label as the page's images. The swap from the in-page
image to the full-size original stays silent, since a picture is
already on screen.

Crawlers follow links, and a multi-megabyte original fetched by every
bot adds up, so keep the original out of the `href`. `LightboxLink`
given the image (`src`) and the width of the largest rendition the
page shows (`width`) links that webp and puts the original in
`data-lb-original`, which the viewer swaps to once open; the content
components above use this form. The plain form (`href`, `w`, `h`, and
an optional `original`) links whatever `href` you pass, so a hand-built
link to the original still exposes it; pass the page's rendition as
`href` and the original as `original` instead. The image form assumes
no global `image.layout` in the Astro config: with one set, Astro adds
its own `fit` to the page's renditions and the link's webp would be a
separate file. When the browser reports data saver or a slow
connection (`navigator.connection`, Chromium only), the viewer stops
at the link's `href` and skips the original; `prefersLeanData` is
exported for the same check elsewhere.

`mountLightbox` takes options: `selector` (default `a.lightbox-link`)
picks the links, `groupSelector` names the containers whose links form
one set, and `labels` renames the viewer's controls for a site that is
not in English.

## Path player

`scripts/path-player.ts` builds a playback modal over a timeline of
samples: the caller supplies the samples, the tracks drawn under the
stage, the stage itself (`buildStage`), and a `sink` that receives
each sample as the clock moves. It opens paused under reduced motion.

```js
import "@half-built/css/plate-modal.css";
import "@half-built/css/path-player.css";
import { createPathPlayer } from "@half-built/astro/scripts/path-player.ts";

const player = createPathPlayer(document, {
  title, source, caption, duration, samples, tracks,
  buildStage: (viewbox) => { /* append the stage, return true */ },
  sink: { start, move, stop },
  scrub: true, // optional
});

button.addEventListener("click", () => player.open(button));
```

`scrub: true` makes the timeline a seek slider: a drag pauses the
clock and seeks, and the arrow, Page, Home, and End keys step it. The
sink then gets `start` at the seek point and `move` along a drag, so
turn it on only when the stage can show any moment on demand; leave
it off (the default) for a simulation that cannot rewind. While
playing, the slider's value moves in whole seconds, so a screen
reader on the focused slider is not flooded. `labels` renames the
transport, the caption toggle, and the slider (`timeline`).

## Plate frame

`scripts/plate-frame.ts` makes the `.plate-frame` pattern's corner box
(`@half-built/css`) open the full view. The frame's
`[data-plate-frame-content]` element moves into the plate modal whole,
so live content keeps running there, and a slot of the same height
holds its place. Every way out of the modal (close box, veil, Escape)
moves it back and returns focus to the corner box.

```ts
import { mountPlateFrames } from "@half-built/astro/scripts/plate-frame.ts";

mountPlateFrames(document);
```

Per frame, optional: `data-plate-label` names the dialog (default
"Enlarged view"); `data-plate-class` and `data-zone-class` add classes
to the modal's plate and zone for sizing. Needs `plate-modal.css`.

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

## Toc

`components/Toc.astro` lists a page's sections in one of two forms,
picked with `form`:

- `form="inline"` (the default) is a collapsed "Sections (N)"
  disclosure in normal flow, for jumping to a section. It needs no
  script.
- `form="panel"` is the open list in a rule box, with the label on its
  top rule, for a rail or side column. `scripts/toc` marks the section
  the reader is in as they scroll.

```astro
---
import Toc from "@half-built/astro/components/Toc.astro";
import { tocFromHeadings } from "@half-built/astro/lib/toc.ts";

const { Content, headings } = await render(post);
---

<article>
  <Toc items={tocFromHeadings(headings)} />
  <Content />
</article>
```

```js
import "@half-built/css/toc.css";
// Only for the panel form:
import { mountToc } from "@half-built/astro/scripts/toc.ts";

mountToc(document);
```

The component renders where it is put and never hides itself. Put the
inline form under the page title, or after a post's hero image; put
the panel in a rail or column:

```astro
<aside class="rail">
  <Toc form="panel" items={items} />
</aside>
<article>
  <h1>{title}</h1>
  <Toc form="inline" navLabel="Sections menu" items={items} />
</article>
```

A page that shows the panel on wide screens and the inline form on
narrow ones renders both, as above, and hides one with its own media
queries. The hooks are the forms' roots: `nav.toc-panel` and
`nav.toc-inline-nav`. Each form is one navigation landmark named
`navLabel` (default: `label`), so when a page carries both, give one
of them its own `navLabel`.

The panel's list scrolls inside the box once it is taller than
`--toc-panel-max-height` (default: the viewport less 6rem). A sticky
rail that fits itself to the viewport can set it to `none` and size
the panel itself: the reference site's rail is a flex column capped
at the viewport, and the panel and its list take `min-height: 0`, so
the list shrinks to whatever the rail's other controls leave.

`tocFromHeadings(headings, { depth })` takes Astro's `render()` headings.
`depth: 3` (the default) lists each `##` with its `###` nested under it;
`depth: 2` lists the `##` only. An `###` before the first `##` is left
out. A page with hand-built sections passes `{ id, text, children }`
items directly. `label` (default `Sections`) heads the disclosure and
the panel. The component renders nothing for an empty list.

In the panel, the current link gets `aria-current="true"`. Inside an
`###`, its `##` gets an accent rule too, without being announced as
current. `mountToc` tracks the first `[data-toc]` on the page (the
panel; pass `{ selector }` for another) and does nothing on a page
with only the inline form. The disclosure is a native `<details>`: its
open state is the reader's. With JavaScript off both forms still work;
the panel just marks nothing.

When to show a TOC, and on which pages, is the consumer's call.

## StatLedger

`components/StatLedger.astro` sets a few figures side by side in one
ruled box, a label over each value. Pass `label` to name the section for
assistive tech; one item may set `accent`.

```astro
<StatLedger
  label="Sample figures"
  items={[
    { label: "Sample A", value: "1,024 units" },
    { label: "Sample B", value: "512 units" },
    { label: "Ratio", value: "50.0%", accent: true },
  ]}
/>
```

It is a `<dl>` and stacks into one column at phone width.

## Meter

`components/Meter.astro` is a segmented bar with `role="meter"`. Props:
`value`, `max`, `label`, `segments` (default 10), `valueText` (default
the clamped value of `max`, such as "3 of 10"), and `class`. The value is
clamped to `0..max`, and a non-finite value reads as empty. It sets
`--meter-fill` and `--meter-segments` inline; the tooling html-validate
preset allows both. A consumer keeping a local copy of
`htmlvalidate.json` must add `--meter-fill` and `--meter-segments` to its
`no-inline-style` allowlist.

## Subscribe status lines

`Subscribe` takes `messages` to replace any of its four status lines
(`invalid`, `pending`, `sent`, `failed`). The lines ride the form as
`data-messages`, so the self-mounting script picks them up per form.

## Import notes

Wildcard subpath imports need explicit file extensions under
TypeScript's bundler mode: `@half-built/astro/lib/slug.ts` and
`@half-built/astro/components/Shell.astro`, not extensionless forms.
Vite resolves either; `tsc --noEmit` only accepts the explicit one.

The `Masthead.astro` export is an alias for `SiteHeader.astro`, the
same component under its public name.
