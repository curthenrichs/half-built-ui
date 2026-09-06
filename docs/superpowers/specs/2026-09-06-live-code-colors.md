# Live Code Block Colors Under Palette Overrides

Date: 2026-09-06. Status: IMPLEMENTED same day. Owner approved
option A and resolved the kin question as "derive them" ("I think we
grow the derivation ... We should be honest about that"). Decisions
recorded at the bottom; the sections below are the reviewed draft.

## The problem

Shiki highlights CodeBlock content at build time and inlines literal
hex values on every token span. The theme
(`packages/astro/src/shiki/code-theme.mjs`) is amber by construction:

| Scope group | Baked value | Relation to the brand ramp |
|---|---|---|
| keywords | `#ffaa3c` | equals `--brand-1-500` exactly |
| functions, tags | `#ffd18a` | amber kin, not a ramp stop |
| strings, constants | `#e07c14` | amber kin, not a ramp stop |
| comments | `#8a7a63` | neutral kin, arguably palette-independent |
| variables, foreground | `#e8d9c3` | `--parchment`, fixed neutral |
| background | `#1b140c` | `--ink-900`, fixed neutral |

The palette editor rewrites the six `--brand-*` custom properties
live, but inline hex on a span is beyond any custom property's reach.
Apply the greens preset and both code blocks on the reference page
(the example.py demo and the npm install line) keep their amber
tokens against a page that is now green. The block chrome
(`--code-bg`, `--code-fg`, `--code-line`) stays fixed-neutral by
design and is not part of this problem.

## Options

### A. Emit var() instead of hex at build (recommended direction)

Make the build write `style="color:var(--code-token-keyword)"` (and
kin) on the spans, then define those custom properties in the css
package from the values above. The editor then re-skins code for free
the moment it sets `--brand-1-500`, with no client JS and no runtime
cost. Two mechanical routes to investigate, in preference order:

1. Shiki's `colorReplacements` option, if Astro's `<Code>` passes it
   through: map each baked hex to a var() string in one place.
2. `createCssVariablesTheme` from shiki: a purpose-built theme that
   emits `--shiki-*` variables. Coarser scope granularity than the
   current theme; the five scope groups would need re-mapping onto
   shiki's fixed variable set.

Token definitions land in the css package's theme files, with
`--code-token-keyword: var(--brand-1-500)` and the rest initially
pinned to today's exact hexes.

### B. Client-side recolor script

A site script walks rendered spans and rewrites colors from a
hex-to-role mapping table whenever the palette changes. Works without
touching the packages, but the mapping table duplicates the theme,
must re-run on every palette event, and silently breaks the day the
theme file changes. Named for completeness; option A makes it
unnecessary.

## The two amber kin need an owner decision

`#ffd18a` and `#e07c14` are not ramp stops, so under option A there
are two choices for what their variables resolve to:

1. **Stay fixed.** Keywords follow the palette, functions and strings
   keep their amber kin values. Partial fix; a green palette still
   shows amber strings.
2. **Derive them.** The palette editor's derivation grows two walked
   stops (a lighter and a darker kin of base 1, walked in OKLCH the
   way the existing stops are), and the site sets them beside the six
   brand properties. Full fix; the derivation, the copyable block,
   and the six-variables story in the About prose all grow past six.

Option 2 is the honest fix but changes the "six variables are the
entire theming surface" claim. Owner call.

## Parity constraint

Swapping baked hex for var() references that resolve to byte-identical
values must not move any rendered pixel on the blog at its next pin
bump. The parity check is the gate; the initial variable values are
pinned to today's hexes for exactly this reason.

## Testing

- Browser smoke: apply a preset, assert a keyword span's computed
  color changed (the code-block twin of the existing accent-chip
  repaint test).
- Unit: if derivation grows kin stops, the derive-palette table tests
  grow matching threshold rows.

## Out of scope

The `.site-toolbar-css` copyable block already follows the code
chrome tokens and contains no highlighted spans; it needs nothing.

## As implemented (2026-09-06)

- Mechanism: a Shiki transformer, `@half-built/astro/shiki/code-vars`,
  rewrites the theme's baked hexes to var() in the style attributes of
  pre and span nodes (route 1 was moot: transformers are first-class
  on Astro's Code component and in markdown.shikiConfig, and a
  transformer keeps the theme's own scope granularity where the
  css-variables theme would not).
- New primitives: `--brand-1-300: #ffd18a` (a true lightness stop,
  OKLCH L 0.885, the family's light kin the way brand-2-300 is) and
  `--brand-1-vivid: #e07c14` (deliberately not numbered: L 0.684 sits
  at the 600's lightness with more chroma, so a ramp number would
  misstate it). The comment ink became `--umber-500: #8a7a63`, a fixed
  system color like red and violet, outside the theming surface.
- New theme roles, identical in both themes: `--code-token-keyword`
  routes brand-1-500, `-function` routes brand-1-300, `-string`
  routes brand-1-vivid, `-comment` routes umber-500. Foreground and
  background map to the existing `--code-fg`/`--code-bg`.
- The override surface is now EIGHT properties; derivePalette grows
  the two kin (seed jump of the amber pair's own OKLCH lightness
  deltas, +0.08 and -0.12, then a lighten walk to 4.5:1 on the code
  ground #1b140c, a third ground constant with its own staleness
  assertion). The amber anchor short-circuits to the shipped kin
  exactly, which also carry the pair's hand-tuned hue shifts the
  hue-holding walk cannot produce.
- The About prose now says eight, names the code viewer as the reason,
  and the token swatch list shows the two code roles live.
- Blog adoption: at the 0.2.0 pin bump the blog may add the
  transformer to markdown.shikiConfig.transformers; the variables
  resolve to the same hexes, so the parity check must still show only
  the chart-track change. Without the transformer the blog renders
  byte-identically to today.
