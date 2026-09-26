# WhenPublished fallback and PostLink plain-text degrade

Date: 2026-09-26. Owner: Curt. Status: design approved in chat, awaiting
spec review.

## Problem

`WhenPublished` renders `{visible && <slot />}`, so a hidden passage
leaves nothing behind. That is right when it wraps a whole clause
("The Mico has its own post.") and wrong when it wraps only a linked
name. The blog has about 13 uses shaped like

```mdx
my Jetson Nano robot, <WhenPublished slug="yam-..."><PostLink slug="yam-...">YAM</PostLink></WhenPublished>, back to
```

While the target is a draft, production renders "my Jetson Nano robot, ,
back to a functioning state." (live in two home automation posts as
of 2026-09-26; it clears when YAM reaches production). The same trap sits in front of every draft
that is linked by name: grow light, PatchFusion, MonoDepth2, Prusa Mini,
BEADZ.

A second, rarer need has no tool today: text that should show only while
the target is unpublished, such as "(blog post in the future)".

## Decisions

Settled with Curt on 2026-09-26.

1. `PostLink` inherits the degrade. When its target is hidden it renders
   its slot as plain text with no element and no styling. When the target
   is visible it renders the link exactly as today. There is no separate
   `PostMention` component.
2. `WhenPublished` keeps its general form and gains an optional named
   `fallback` slot, rendered only while the target is hidden. A use with no
   fallback behaves exactly as today.
3. Fallback text is unstyled. A reader should not be able to tell a
   pending link from ordinary prose.
4. The house rule becomes: `PostLink` for names; `WhenPublished` when the
   whole phrase only makes sense once the post exists ("see it here", "its
   own post"), with a `fallback` when the sentence needs one.

## Package changes (`@half-built/astro`)

### `lib/drafts.ts`

- `Linkable` gains `draft?: boolean` in `data`, matching `ForwardLinkable`.
  A `CollectionEntry` already carries it, so consumers pass the same
  `posts` they pass today.
- New pure function `postLinkHref(slug, posts, showDrafts): string | null`.
  It throws on an unknown slug (same message shape as today, `PostLink: no
  post has slug "x"`), returns `null` when the target is a draft and
  `showDrafts` is false, and otherwise returns `resolvePostHref(slug,
  posts)`.
- `resolvePostHref` stays as is. It must keep resolving drafts: the blog's
  `PostLink` wrapper calls it to look up the link tip, and `SHOW_DRAFTS`
  builds link drafts normally.
- The file's `PostLink` comment block is rewritten for the new behavior.
  The eager-slot note stays (a `PostLink` inside a hidden `WhenPublished`
  still runs, and now simply renders text that is then discarded).

### `content/PostLink.astro`

- New optional prop `showDrafts?: boolean`, default `false`, the same name
  and meaning as on `WhenPublished`.
- Body: `href = postLinkHref(slug, posts, showDrafts)`. With an href, the
  current `<a href data-tooltip class>`. Without one, `<slot />` alone: no
  wrapper element, so no `class` and no `data-tooltip` land in the page.

### `content/WhenPublished.astro`

- Visible: `<slot />` as today. Hidden: `<slot name="fallback" />`, which
  renders nothing when the slot is absent.
- MDX call-site syntax is `<Fragment slot="fallback">...</Fragment>`. The
  plan's first task verifies that Astro's MDX honors `slot` on `Fragment`
  inside a component child. If it does not, the documented syntax falls
  back to `<span slot="fallback">`, which adds an unstyled inline element
  and is otherwise equivalent. Whichever works is the one the README
  documents; the spec does not change.

### Tests (`packages/astro/test/lib.test.ts`)

- `postLinkHref`: resolves a published target; returns `null` for a draft;
  resolves the draft when `showDrafts` is true; throws on an unknown slug.
- `resolvePostHref` tests stay unchanged.

### Reference site (`site/src/pages/index.astro`)

- The "When published and Post link" section gains two demos against the
  existing `samplePosts` (one published, one draft):
  - A `PostLink` to `sample-draft` inside ordinary prose, rendering as
    plain text.
  - A `WhenPublished` on `sample-draft` with a `fallback` that renders in
    place of the hidden passage.
- The section copy says what each shows, in the site's impersonal active
  demo voice.
- A site test asserts the built page has no `href` containing
  `sample-draft`, contains the draft `PostLink`'s text, and contains the
  fallback text.

### README (`packages/astro/README.md`)

The "WhenPublished and PostLink" section documents the degrade, the
`showDrafts` prop on `PostLink`, the `fallback` slot with its MDX syntax,
and the names-versus-phrases rule from decision 4.

### Release

A behavior change on a 0.x package: minor bump to 0.10.0 across the three
packages (fixed versioning, the bump guard requires it). Release is the
standing flow: merge to main, tag `v0.10.0`, push the tag. That is Curt's
step.

## Blog changes (`half-built-robots-blog`, after the release)

1. Pin bump to 0.10.0, then restart the dev server (Vite 504s otherwise).
2. `src/components/content/PostLink.astro` passes `showDrafts={SHOW_DRAFTS}`
   and skips the `linkTip` lookup when the target is hidden (no link, no
   tip). `src/components/content/WhenPublished.astro` forwards the named
   slot (`<slot name="fallback" slot="fallback" />`).
3. Content sweep, no baggage: every `WhenPublished` whose only child is a
   single `PostLink` to the same slug becomes a bare `PostLink`. Clause
   wrappers stay. The sweep is found by pattern, not by the list in this
   spec, and the count is reported in the commit.
4. `CLAUDE.md` house rules: the two `WhenPublished` / `PostLink` bullets
   are rewritten for decision 4 and the degrade.
5. Tests:
   - `test/post-link.test.ts`: the deploy-build guard (no draft slug in any
     built page) stays and still passes. Add a case that a known published
     page linking a draft by bare `PostLink` contains the name as text and
     no link to the draft. If no draft is linked that way at the time, the
     case uses a fixture assertion on `postLinkHref` instead of a built
     page.
   - `test/drafts.test.ts` unchanged.
6. Full `npm test`, then the browser suites, then a production build
   compared against the current one for pages outside the sweep (parity:
   production builds only).

## Out of scope

- Styling or marking pending links.
- Changing `WhenPublished` for clause uses beyond the optional fallback.
- The parked WhenPublished excerpt leak (teaser text reaching cards and
  the feed); decided not worth the hassle on 2026-09-20.

## Success criteria

- No blog page renders an empty gap where a draft's name belongs.
- A `PostLink` to a draft in a deploy build renders its text and no link.
- A `WhenPublished` with a fallback renders the fallback in a deploy build
  and the passage in a `SHOW_DRAFTS` build.
- Existing uses with no fallback render byte-identical output.
- Package tests, site tests, and the blog's full suite pass.
