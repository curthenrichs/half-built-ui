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
- One package change only: the phase 0 primitive rename below. Beyond
  it the editor is site-side script and the packages do not change in
  this project.
- No exhaustive API documentation. Props tables and per-field detail
  stay in the package READMEs and `models.ts`; the page's prose is
  usage and rationale, not reference.
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

Each section opens with a short what-and-why passage: what the
component is for, when to reach for it, and the design reasoning where
there is a story worth telling (the amber-700 ink retuning, the draft
badge, why prose width is never capped). This is public reader-facing
text in Curt's voice, drafted from his existing writing on the blog;
any rationale only he holds gets a `< Curt fill in: ... >` marker
rather than an invented explanation. Each section heading also carries
the component's package import line in a small code element.

Sample data stays invented and neutral, images stay the geometric
placeholders. The existing index.astro content reorganizes into these
sections; nothing is rewritten for its own sake.

## The toolbar

A fixed toolbar (top-left on desktop and tablet, bottom-left on
phones, small, collapsible; owner calls 2026-09-06) carries the global
knobs: the ThemeToggle and the palette editor. It is site chrome, not
a package component, and must not overlap content at any viewport
width the blog's breakpoints define.

## The palette editor

### Phase 0: the primitive rename (@half-built 0.2.0)

The six accent primitives are named after the hues they happen to be
(`--amber-500`, `--cyan-700`, `--ochre-600`), so a third-party override
means writing green values into variables named amber. Before the site
work, the css package renames them to hue-neutral ramp names, values
unchanged. Two brand families, numeric lightness stops kept; ochre
folds into family 1 as its 600 stop, which is what it is:

| New name | Old name | Value | Role |
|---|---|---|---|
| `--brand-1-500` | `--amber-500` | `#ffaa3c` | brand 1 base: lines, fills, dark-theme text ink, light-theme focus ring |
| `--brand-1-600` | `--ochre-600` | `#d98a1f`, retuned to `#d1820f` (see below) | brand 1 chart kin (light-theme track-x) |
| `--brand-1-700` | `--amber-700` | `#a36300` | brand 1 ink on the light paper |
| `--brand-2-300` | `--cyan-300` | `#8ee6f2` | brand 2 light kin: dark-theme text ink and track-y |
| `--brand-2-500` | `--cyan-500` | `#3cc7dd` | brand 2 base: lines, fills, dark-theme focus ring |
| `--brand-2-700` | `--cyan-700` | `#1a7f90` | brand 2 ink on the light paper |

The old names are referenced nowhere outside the package's own two
theme files (verified 2026-09-05 across the blog's src and this repo),
so no aliases ship; the rename is a clean cut. The semantic layer
(`--accent-1`, `--accent-1-ink`, and kin) keeps its names; it is the
role vocabulary, the primitives are the raw ramps beneath it.

Sequence: rename lands in the css package, all three packages release
as 0.2.0 under the fixed-version rule (merge to main, tag, push the
tag), the blog bumps its exact pins with the usual parity check, and
the site work then targets 0.2.0. One value rides the release beside
the rename (owner call, 2026-09-05): the 600 stop was retuned from
`#d98a1f` (2.76:1 on white, under the 3:1 non-text gate) to `#d1820f`
(3.04:1), walked down in OKLCH with hue and chroma held. The parity
check must show exactly one class of rendered change, the light-theme
chart track color; everything else must not move. The other accent primitives (red, violet)
keep their hue names; they are fixed system colors, not part of the
theming surface.

### Override surface

The six `--brand-*` primitives are the entire theming surface.
Everything else in both theme files routes through them or through
neutrals that stay fixed.

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

- `--brand-1-700` and `--brand-2-700`: darken until contrast with the
  light theme's paper is at least 4.5:1 (text ink).
- `--brand-2-300`: lighten until contrast with the dark theme's ground
  is at least 4.5:1 (text ink).
- `--brand-1-600`: darken until contrast with the light theme's paper
  is at least 3:1 (non-text chart line).

The two ground values live in one site module whose unit test asserts
they match the installed css package's theme files, so they cannot go
stale silently (a runtime read only sees the active theme's computed
values, and derivation needs both grounds at once). Derivation is a pure
function `derivePalette(base1, base2)` returning the six hex values;
feeding it today's amber and cyan bases short-circuits to the six
shipped hexes exactly (final-review ruling 2026-09-05), so the default
chip reproduces the defaults. The 600 stop's old value sat at 2.76:1
on white, under the 3:1 target the derivation holds walked stops to;
the owner resolved that gap the same day by retuning it to `#d1820f`
(the phase 0 section records the walk), so every shipped default now
clears its gate.

### The bases are the user's, so they get readouts, not corrections

Dark theme uses both picked bases directly as text
(`--accent-1-ink: var(--brand-1-500)` after the rename, focus rings,
and similar). The
editor never alters a picked base. Instead the panel shows one status
line: "Contrast checks pass." when both bases clear the dark-text
gate, or a warning naming the accent ("Accent 1 is too dark to read
as text on the dark theme, consider a lighter shade"). Raw ratios are
not displayed (owner call 2026-09-06: no instrument panel), and the
generated block sits behind a "Show CSS" disclosure so the panel
stays a small set of controls. Derived stops always pass by
construction.

### Apply and copy

Applying sets the six properties inline on `document.documentElement`,
which wins over the token files and cascades through both themes, so
the theme toggle keeps working against the custom palette. The copy
button emits a finished block:

```css
/* half-built palette override, generated at ui.half-built-robots.com */
:root {
  --brand-1-500: #2f9e44;
  --brand-1-600: #23863a;
  --brand-1-700: #1f7a33;
  --brand-2-300: #7fd8a0;
  --brand-2-500: #0ca678;
  --brand-2-700: #067a5b;
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

Phase 0, the rename release: the primitive rename above lands, 0.2.0
ships, the blog bumps its pins with a parity check. The site work does
not start until the blog is green on 0.2.0.

Phase 1, content and knobs on `dev`: restructure the page into
sections, build the toolbar and editor, land the tests. Create the
Pages project early against `dev` so every push is reviewable at the
preview URL.

Phase 2, go-live: production branch `main`, first deliberate dev to
main merge, CNAME `ui` on the half-built-robots.com zone, then a
smoke pass against the production URL.

## Recorded follow-ups (not this project)

- The blog's /policies/style page moving or redirecting here was
  raised at step 11.4 and stays an open owner decision once this site
  is live.
