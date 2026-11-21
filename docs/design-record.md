# Design record

The decisions behind the @half-built packages that still bind. Most of
them were made while extracting the design system out of the blog
(August and September 2026). This file is kept current: when a decision
changes, change it here in the same commit.

The working rules (boundaries, workflow, releases) are in `CLAUDE.md`.
How to use each package is in its README.

## Who the packages serve

- The consumers are the blog and BEADZ. The portfolio is a cousin, not a
  consumer: it has its own stack, style, and footer.
- Tokens and the config contract are designed for any number of sites,
  because more subdomains are expected.
- Where the blog and BEADZ disagree, the blog wins. BEADZ is a prototype
  that restyles to match.

## What stays in a consumer

These never move into a package:

- The site's layouts and page shells, its sidebar, `PostLink`,
  `WhenPublished`, the fluid path player and its vendored simulation, the
  values in its `config.ts`, its prose overrides, and its own CSS layer.
- Everything Henry. If Henry ever entered a package, that package's
  LICENSE would first need the same brand-assets carve-out every other
  repo carries.
- Meta, OG, and JSON-LD tags. Those go in a site-side `Seo` component.
  `Shell` and `TwoColumn` hold structure only, so another site can reuse
  the frame without forking it.
- The blog's three-band header. It recreates a retired WordPress theme,
  and BEADZ has its own masthead.
- Rules that depend on a page's context, like hiding Subscribe after a
  post. The layout owns those.

`Subscribe` is in the package because both sites post to the same
Buttondown list. The endpoint and the copy are props.

## Package boundaries

- Package components import nothing from a site: no `astro:content`, no
  site `lib`, no site `config`. Callers pass view-models (typed in
  `components/models.ts`), and links arrive as an `href`, never a slug.
- The package ships no image assets. `CategoryCard`'s image is
  required, and the caller supplies it.
- `@fontsource/roboto-mono` is the one runtime dependency of
  `@half-built/css`, an exception to "no dependencies".
- The palette derivation lives in `@half-built/tooling/palette`
  (2026-11-15), not in the site: a consumer's build derives and
  asserts the same ramp the reference site's editor prints, and the
  editor imports it from the package. It is pure math over culori,
  which is a runtime dependency of tooling for that reason.
- The page TOC lives in the package (`Toc.astro`, `lib/toc.ts`,
  `scripts/toc.ts`, `toc.css`; owner, 2026-11-15). It has two forms
  the consumer places: an inline "Sections" disclosure in normal flow
  under the title or a post's hero, and an open panel for a rail that
  marks the current section. The package never measures the page or
  hides a form; which shows at which width is the consumer's. The
  blog uses the inline form only, at every width; the reference site
  puts the panel in its rail under the Palette knob above the tablet
  break and the inline form under the title below it (owner,
  2026-11-21). Rejected along the way: a floating tab on small
  screens, which covered the column's edge (2026-11-18), and an open
  strip hung in the empty gutter left of the page (2026-11-21). On a
  small screen every pixel is for content, furniture, or a CTA, and
  the TOC's job there is jumping, not "where am I". It never goes in
  the blog's sidebar, which stays in normal flow. It lists one or two
  heading levels, never the full tree. When to show it is the
  consumer's call: the threshold and any per-page override live in
  the consumer.

## Islands

Every client behavior is `mount(root, options?)` returning a handle with
`destroy()`. A mount claims its root with a data attribute, so mounting
twice is a no-op, and a mount releases only a claim it owns. Options
carry the selectors and copy, and default to the current behavior. The
contract lives in `packages/astro/src/scripts/core/island.ts`.

Not built, on purpose:

- A focus-trap utility. Every modal uses native `<dialog>.showModal()`.
- Islands for the parse-time inline scripts (the theme stamp, focus
  mode, the footer's phone collapse). Moving them into islands would
  change when they run.

## Tokens and CSS

- Components read roles, never primitives. That split is what makes the
  dark theme work.
- Hex values live only in the token files.
- Breakpoints: the three system names (phone, sidebar, tablet) are
  tokens. A media query specific to one component (600, 700, 800, 480,
  481) stays a literal px value, and so do `sizes` attributes. `tablet`
  is kept even though no package CSS uses it yet.
- Focus rings stay a literal 2px. Only border strokes use `var(--stroke)`.
- Plain-English class names stay: `site-*`, `menu-*`, `masthead`,
  `colophon`, `screen-reader-text`.
- `themeStorageKey` has no default. Leaving it out means the theme
  choice isn't remembered.
- Reduced motion: `base/reset.css` sets `animation: none !important` and
  `transition: none !important` on everything under
  `prefers-reduced-motion: reduce`. That overrides any consumer's own
  handling. A consumer that wants a gentler reduced-motion animation has
  to beat that rule on purpose.
- Prose width is never capped. The stylelint config bans `ch` measures
  everywhere; the other half of the rule (a prose stylesheet's only
  `max-width` is the `100%` image fit) needs selector context that
  stylelint can't see, so each consumer pins it in its own test. See the
  css README.
- Stacking is an engineered system (2026-11-21). Page layers use the
  `--z-*` ladder and carry their rung on the floating box; no ancestor
  may be a lower-rung stacking context; local decoration uses
  `--z-raised` and `--z-raised-top`; consumers add `--z-<name>` rungs
  (49 and 50 are reserved). The link tip tops the ladder at 100, over
  the search flyout (owner, 2026-11-21): it labels exactly what the
  pointer is on, is transient and `pointer-events: none`, so nothing
  should cover it. The tooling preset allows only `auto` or
  `var(--z-*)` for `z-index`, a breaking lint change in 0.19.0. It
  followed a demo bug: the open Palette panel painted under the rail's
  TOC panel because both were `z-index: auto` and DOM order decided,
  after a one-off guard was removed as dead code. The demo's browser
  suite now holds it two ways: named on-top tests for the overlays the
  demo renders (palette panel, mobile menu, popout in both modes, a
  link tip over the popout), and a generic check that no element on a
  page rung sits inside a lower stacking context, run with each of
  those overlays open. Only demoed overlays are covered, so a new one
  must be demoed to be tested. One published-component
  change: `.site-header-wrapper` dropped its `z-index: 1`, since that
  low-rung context capped the mobile menu and search flyout under a
  consumer's fixed panel. See the css README, Stacking.

## Consumers

- Pin the packages at an exact version. Never patch `node_modules` or
  re-fork a package file; fix it here and publish.
- When swapping a shared component in, move every importer at once. Two
  module identities for one island load its script twice.
- Compare production builds when checking parity. The vitest build runs
  in DEV mode, which adds `data-image-component` and reorders styles.

## The ecosystem endpoint

The footer's Ecosystem column is one hosted document,
`https://ecosystem.half-built-robots.com/ecosystem.json`, served from the
`half-built-ecosystem-data` repo (its README has the schema and the edit
loop). Adding a property is one commit there, and no site rebuilds.

The package hardcodes no URL. `mountEcosystem(document, { endpoint,
selfKey, limit?, retryDelaysMs? })` finds the `[data-ecosystem]` list
in `Footer` and:

1. Fetches the document, with a 3-second timeout per attempt. It retries
   up to three times on a network error, a timeout, a 429, or a 5xx,
   with backoff and jitter. A 404 or other 4xx is not retried.
2. Refuses a payload that doesn't parse, isn't `version: 1`, has no
   entries, or has a malformed entry, and falls back to the last good
   copy in localStorage (kept for 24 hours).
3. Refuses any document without an entry for `selfKey`, because a site
   must never render a list that leaves itself out.
4. Sorts its own family first, then the rest, each by `priority` and then
   label, and takes the first `limit` (default 6).
5. Replaces the list with the same three states the component renders:
   itself as plain text, a live property as a link, and an undeployed one
   (null `href`) as plain text.

With no script, a dead endpoint, or a refused payload, the footer keeps
the list the site rendered from its own props.

## Open exceptions

- Two Henry derivatives are drawn locally in the blog: the monochrome
  portfolio glyph in `src/lib/social-icons.ts` and
  `src/assets/henry-placeholder-banner.svg`. Both wait on a monochrome
  form in `henry-mascot`.
- `alt` is optional on `BlogImage`, `GalleryImage`, `MediaText`, and
  `Step` (default `""`). Only `SmartImage` requires it.
- Variant prop names were never unified (`Callout.type`,
  `MediaText.mediaSide`), and `Callout` and `Footer` have no named slots
  beyond `site-info`.
- Some blog-specific sizes still live in package components: `BlogImage`
  caps `narrow` at `min(495px, 100%)`, `Step` uses 200px tracks, and the
  header straddle offsets in `SiteHeader.astro` are literal
  `calc(-30px + ...)`.
- There is no block-rhythm token; `Spacer` fills that gap.
