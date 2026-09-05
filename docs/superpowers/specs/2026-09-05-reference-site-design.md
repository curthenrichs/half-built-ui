# Reference Site Design ~ ui.half-built-robots.com

Date: 2026-09-05. Status: approved direction, pre-implementation.

## What this builds

The `site/` workspace grows from a private kitchen-sink build gate into
the public reference site for the @half-built packages, hosted on a new
Cloudflare Pages project at ui.half-built-robots.com. The site shows
every component's meaningful variants on one sectioned page, and carries
two global knobs: the existing day/night theme toggle and a new palette
editor that re-skins the whole system live and emits a copyable CSS
override block. The editor is the adoption story: a third party
re-brands the system by pasting six custom properties, and the page
proves it works before they do.

## Goals and non-goals

Goals:

- Host the demo publicly with the same branch discipline as the blog
  (`main` is production, `dev` is the preview build).
- One sectioned page with a sticky table of contents; each section
  renders the pre-baked variants of its components.
- A palette editor: pick two base colors, auto-derive the dependent
  stops to accessibility compliance, apply live, copy the override
  block.
- A small test suite in this repo covering the derivation math and an
  axe pass on both themes.

Non-goals:

- No per-prop playground, no Storybook-style machinery. Variants are
  pre-rendered at build time; the only live controls are the global
  knobs.
- No package changes in this project. The editor is site-side script.
  Hue-neutral aliases for the accent primitives (a green theme
  currently overrides variables named amber) are a recorded wart for a
  future @half-built/css minor, alongside the registered global.css
  naming review. Not here.
- No usage documentation beyond the import line shown per section. The
  package READMEs remain the docs.
- Henry does not appear. The repo boundary holds.

## Hosting and branches

A new Cloudflare Pages project (working name `half-built-ui`) builds
the repo with root directory `site/`, `npm install` at the repo root
(workspaces), and `npm run build --workspace site`. Production branch
is `main`, serving ui.half-built-robots.com via a CNAME on the
half-built-robots.com zone; every push to `dev` builds a preview at
the pages.dev subdomain. The committed pre-push hook already refuses
direct pushes to `main`, so the workflow needs no changes: fold to
`dev`, review on the preview, deliberate merge to `main` to ship.

Go-live order: create the Pages project against `dev` first so the
preview exists while the content lands, then set the production branch
and DNS as the final step.

## Page structure

One page, anchored sections, sticky TOC (the blog's sidebar widget
pattern, built from package components where possible):

1. **Intro**: what the system is, the three packages with npm links,
   the install line. Short; the README carries the prose.
2. **Chrome**: SiteHeader, Footer, ThemeToggle as rendered by the
   page's own shell.
3. **Cards**: PostCard variants (default, draft, no-hero, multi
   category), CategoryCard.
4. **Navigation**: Pagination states, PostNavigation.
5. **Widgets**: Widget, LinkListWidget, Subscribe (both themes' panel
   treatment noted in captions).
6. **Content**: Button, Callout types, Quote, Step/Walkthrough,
   Gallery/GalleryImage, BlogImage, MediaText, CodeBlock, Palette,
   Group, Spacer.
7. **CSS**: token swatches read live from the computed styles (so the
   palette editor changes them too), prose specimen, patterns.

Each section heading carries the component's package import line in a
small code element. Sample data stays invented and neutral, images
stay the geometric placeholders. The existing index.astro content
reorganizes into these sections; nothing is rewritten for its own
sake.

## The toolbar

A fixed toolbar (bottom-right, small, collapsible) carries the global
knobs: the ThemeToggle and the palette editor. It is site chrome, not
a package component, and must not overlap content at any viewport
width the blog's breakpoints define.

## The palette editor

### Override surface

Six primitives are the entire theming surface. Everything else in both
theme files routes through them or through neutrals that stay fixed:

| Variable | Today | Role |
|---|---|---|
| `--amber-500` | `#ffaa3c` | accent 1 base: lines, fills, dark-theme text ink, light-theme focus ring |
| `--amber-700` | `#a36300` | accent 1 ink on the light paper |
| `--ochre-600` | `#d98a1f` | accent 1 chart kin (light-theme track-x) |
| `--cyan-500` | `#3cc7dd` | accent 2 base: lines, fills, dark-theme focus ring |
| `--cyan-300` | `#8ee6f2` | accent 2 light kin: dark-theme text ink and track-y |
| `--cyan-700` | `#1a7f90` | accent 2 ink on the light paper |

### Controls

Two color pickers (accent 1 base, accent 2 base) plus preset chips:
Amber/Cyan (the defaults, also the reset), Portfolio blues, and one
designed complementary-greens example. Picking a preset loads its two
bases through the same derivation path as a manual pick, so the chips
are examples, not special cases.

### Derivation

From the two picked bases, the four dependent stops are computed in
OKLCH by walking lightness (hue and chroma held, chroma reduced only
if the gamut requires it) until each clears its threshold, then
converting back to hex:

- `--amber-700` and `--cyan-700`: darken until contrast with the light
  theme's paper is at least 4.5:1 (text ink).
- `--cyan-300`: lighten until contrast with the dark theme's ground is
  at least 4.5:1 (text ink).
- `--ochre-600`: darken until contrast with the light theme's paper is
  at least 3:1 (non-text chart line).

The thresholds compare against the theme files' actual ground values
read at build time, not hardcoded copies. Derivation is a pure
function `derivePalette(base1, base2)` returning the six hex values;
feeding it today's amber and cyan bases must return stops that clear
the same thresholds today's hand-tuned values clear (regression
anchor; exact-match with the hand-tuned hexes is not required).

### The bases are the user's, so they get readouts, not corrections

Dark theme uses both picked bases directly as text
(`--accent-1-ink: var(--amber-500)`, focus rings, and similar). The
editor never alters a picked base. Instead the panel shows a compact
readout per base: contrast as dark-theme text and as a line or fill on
each ground, with a pass mark or a warning ("too dark to read as text
on the dark theme, consider a lighter shade"). Derived stops always
pass by construction and display their computed values.

### Apply and copy

Applying sets the six properties inline on `document.documentElement`,
which wins over the token files and cascades through both themes, so
the theme toggle keeps working against the custom palette. The copy
button emits a finished block:

```css
/* half-built palette override, generated at ui.half-built-robots.com */
:root {
  --amber-500: #2f9e44;
  --amber-700: #1f7a33;
  --ochre-600: #23863a;
  --cyan-500: #0ca678;
  --cyan-300: #7fd8a0;
  --cyan-700: #067a5b;
}
```

State persists in localStorage (same conventions as the theme key) so
a reload keeps the palette; reset clears it.

## Testing

- **Unit**: `derivePalette` in the site's own small vitest (or node
  test) setup: threshold compliance for a table of picked bases
  including pathological ones (near-white, near-black, saturated
  edge-of-gamut), plus the amber/cyan regression anchor.
- **Browser**: the repo's existing puppeteer kit (from
  @half-built/tooling) gets a site suite: axe pass on both themes with
  the default palette, a smoke that applying a preset changes a
  computed style and that copy produces parseable CSS declaring
  exactly the six variables.
- **Build**: the site build stays the CI gate it already is.

## Sequencing

Phase 1, content and knobs on `dev`: restructure the page into
sections, build the toolbar and editor, land the tests. Create the
Pages project early against `dev` so every push is reviewable at the
preview URL.

Phase 2, go-live: production branch `main`, first deliberate dev to
main merge, CNAME `ui` on the half-built-robots.com zone, then a
smoke pass against the production URL.

## Recorded follow-ups (not this project)

- Hue-neutral primitive aliases in @half-built/css so third parties
  are not overriding variables named amber; rides the registered
  naming review at a future minor.
- The blog's /policies/style page moving or redirecting here was
  raised at step 11.4 and stays an open owner decision once this site
  is live.
