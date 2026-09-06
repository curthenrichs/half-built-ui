# Live Code Block Colors Under Palette Overrides

Date: 2026-09-06. Status: draft, awaiting owner review. Nothing here
is implemented.

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
