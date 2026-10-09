# @half-built/css

Design tokens, base styles, patterns, and prose CSS for the half-built
design system.

## Provenance

Extracted from the private `half-built-robots-blog` repository, where
this CSS was built and used in production. The extraction review that
checked it for blog-specific assumptions before the move is the design
record for this package.

## Usage

Import order matters. In your base layout, load the layer declaration
first, then tokens, then the base entry, then the patterns you use:

```js
import "@half-built/css/layers";
import "@half-built/css/tokens";
import "@half-built/css";
import "@half-built/css/patterns.css";
import "@half-built/css/prose.css";
import "@half-built/css/code.css";
```

The island stylesheets (`lightbox.css`, `plate-modal.css`,
`path-player.css`, `popout.css`) load the same way, from whichever
layout or component mounts their island. The `.` entry is the base
layer (reset, shell, link-tip, scroll-top); it is not the whole
system, which is why the explicit order above exists.

The breakpoints are `@custom-media` rules, so your build needs
`postcss-custom-media` with `@csstools/postcss-global-data` fed the
breakpoints file:

```js
// postcss.config.mjs
import { fileURLToPath } from "node:url";
const breakpoints = fileURLToPath(
  import.meta.resolve("@half-built/css/tokens/breakpoints.css"),
);
// plugins: [postcssGlobalData({ files: [breakpoints] }), postcssCustomMedia()]
```

Sites add their own `site` cascade layer after these imports for local
overrides. The layer order in `layers.css` already declares it.

## Architecture

### Layers

`layers.css` declares the cascade once: `@layer tokens, base, patterns,
components, components.plate, components.lightbox, components.player,
site;`. Later layers win, and a consumer's unlayered styles (an Astro
component's own scoped `<style>` block, for instance) always win over
every layer, since unlayered rules outrank all layered ones. `site` is
the extension point: a consumer's own layer, declared last, for local
overrides.

| Layer | File | Owns |
|---|---|---|
| tokens | `tokens.css`, importing `tokens/primitives.css`, `tokens/theme-light.css`, `tokens/theme-dark.css` | Custom properties only |
| base | `global.css`, importing `base/reset.css`, `base/shell.css`, `base/link-tip.css`, `base/scroll-top.css` | Element defaults, a11y utilities, the page shell, and the two chrome pieces that pair CSS with a script |
| patterns | `patterns.css` | The visual grammar (below) |
| components | `prose.css`, `code.css`, `popout.css`, plus each modal island's own sublayer | Layout and behavior unique to one component or content domain |

The plate-modal family sits in three sublayers of `components`:
`components.plate, components.lightbox, components.player`, in that
order. `plate-modal.css` holds the shared chrome; `lightbox.css` and
`path-player.css` override it by sublayer order, so the three files
can be imported in whichever order a consumer needs. Unsublayered
`components` rules (prose, code, the popout) rank above all three
sublayers, which is fine since they never target modal elements.

### Patterns

Each pattern is defined exactly once, in `patterns.css`. A component
applies the class and adds only its own contextual offsets and margins
in scoped styles.

- `.press-box`: a bordered light box that inverts to ink while held.
  `.press-box-shaded` is the same box on a ground of ink at 20% over
  the surface. `.press-box-accent` wears an accent's combination
  instead (accent line, accent ink, a 6% tint of the accent as the
  ground), filling solid while held; knobs `--press-accent`,
  `--press-accent-ink`, `--press-on-accent` are set by
  `.press-box-accent-1` (the first brand family) and
  `.press-box-accent-2` (the second). `Button.astro` renders all of it
  as `variant="plain" | "shaded" | "accent-1" | "accent-2"` with
  `size="md" | "lg"`.
- `.button-row` (with the `.button-row-center` modifier): a wrapping
  flex row with a 10px gap for buttons shown side by side.
- `.caption`: a small quiet line (`xs`, opacity 0.75) under images,
  beside media text, or after quotes. Alignment and spacing stay local.
- `.micro-label`: `xs`, bold, tracked 0.08em, for small plate and status
  labels. Case is the caller's.
- `.draft-stamp`: an overlay in the accent color for marking
  unpublished content on a card or hero; size and stacking stay local.
- `.chip`: a filled label in ink with the surface's inverse text.
  `CornerBadges.astro` pins chips to an image's lower-right corner; the
  component owns that placement, the parent only supplies
  `position: relative`.
- `.rule-box`: a plain bordered box at frame padding (`Group.astro`;
  `Callout.astro`'s box under its own tint and label).
- `.tint-overlay`: a positioned `::before` filling the element with
  `--tint-color` (default `--ink`) at `--tint-opacity` (default 0.1).
  `Callout.astro` sets its own tint color instead of reimplementing the
  pseudo-element.
- `.bracket-frame`: 2px top and bottom rules with 2px edge verticals
  fading through the middle, the layout's signature enclosure.
- `.boxed-label`: a bordered 2px label box on the page background,
  meant to straddle a frame rule; the straddle offset is contextual and
  stays in the component.
- `.icon-box`: a 30x30 bordered 2px interactive square (icon buttons, a
  search magnifier).
- `.field-join` (with `.field-join-input` and `.field-join-button`): a
  text entry and its action button fused into one 2px-bordered box,
  with square inset focus rings so an outside ring cannot cut across
  the fused geometry. The button carries `.press-box.press-box-shaded`.
  Color knobs `--field-ink`, `--field-text`, `--field-well`,
  `--field-ring` default to the theme's own ink and surface;
  `Subscribe.astro` sets them from its `--panel-*` roles instead.
  `--field-ring` is the input's click highlight only: with the root
  stamped `data-focus="keyboard"` (`scripts/focus-mode.ts`) the input
  rings in `--focus-ring` instead, so no component ever overrides the
  keyboard ring.
- `.plate-frame` (with `.plate-frame-plate` and `.plate-frame-corner`):
  the plate modal's frame inline. The outer box takes the modal zone's
  padding and paints the four 22px `--accent-1` corner strokes from its
  own background, so the markup carries no corner elements. The plate
  inside wears the modal plate's `--surface` and `--shadow`; compose
  `.bracket-frame` on it for the modal's rules. An `.icon-box` with
  `.plate-frame-corner` straddles the plate's top-right corner where
  the modal's close box sits. At phone width the corners drop and the
  box moves inside the plate, as in the modal. The values mirror
  `plate-modal.css` and change with it.

  ```html
  <div class="plate-frame">
    <div class="plate-frame-plate bracket-frame">
      <button
        type="button"
        class="icon-box plate-frame-corner"
        aria-label="Enlarge"
      >
        <!-- icon -->
      </button>
      <!-- content -->
    </div>
  </div>
  ```

- Modal chrome inherits rather than copies: the plate's arrows,
  transport, and close box are `.icon-box`; its labels are
  `.boxed-label`; the image lightbox composes `.bracket-frame`,
  `.boxed-label`, and `.icon-box`, with only modal-specific offsets and
  two color tokens (`--veil`, `--mat-line`) living in the theme files.
- Hard rules are not a class: they are `--rule` borders at `--stroke`
  widths applied directly, with `--hairline` for faint dividers.

### The second accent

`--accent-2` and `--accent-2-ink` (the second brand family: `--brand-2-500`
and `--brand-2-700` by default) are the first accent's complement,
chosen so their contrast profile matches it on both grounds: the bright
value is a line or fill, the dark one is text on the light ground.
`.press-box-accent-2` is the only pattern that reaches for it directly;
the chart token `--track-y` draws on the same family independently
(`--track-z` is a separate fixed violet primitive, not part of either
brand family). It is a reserved second voice for a consumer that needs
one, such as a success state or a second data series, not a link color
and not a second brand identity.

### Keyboard focus

One rule, in `base/reset.css`: `:focus-visible` draws a 2px outline in
`--focus-ring`, held 2px off the element. It is `:focus-visible`, never
`:focus`, so a mouse click leaves nothing behind, and it is deliberately
not the hover look, so focus never reads as hover. Components keep
their own hover treatments and set no focus color of their own. The
documented exceptions are the joined field's inset rings
(`.field-join-input:focus-visible`, `.field-join-button:focus-visible`),
since an outside ring would cut across the fused box, and offset-only
adjustments where a container's overflow would otherwise clip an
outside ring (`PostCard.astro`).

### Themes

Light is the plain `:root` in `tokens/theme-light.css`; dark is
`tokens/theme-dark.css` on `:root[data-theme="dark"]`. No stylesheet
reads `prefers-color-scheme`: the astro package's `Shell.astro` stamps
the attribute inline in the head at first paint, from a stored choice
or, with nothing stored, the OS preference, so there is no flash of
the wrong theme; `ThemeToggle.astro` and `scripts/theme-toggle.ts` flip
it afterward and remember the choice under a storage key the consumer
supplies.

The panel roles (`--panel-bg`, `--panel-ink`, `--panel-rule`,
`--panel-error`, `--panel-ring`) invert with the theme so a panel's
action button stays the brightest element in it in both themes;
`Subscribe.astro` is the package's own consumer of them.

### Tokens

`tokens.css` is the entry point (the `@half-built/css/tokens` export);
its values live under `tokens/`:

- `primitives.css`: the raw palette, strokes (`--stroke-2`,
  `--stroke-3`), spacing (`--frame-pad`, `--column-gap`), the shell
  metrics (`--shell-max`, `--shell-pad`, `--header-clear`),
  `--dock-bottom`, the z ladder (`--z-*`), motion, and the fluid type
  scale. Theme-independent; nothing outside `tokens/` reads a
  primitive. The six brand primitives are the package's only
  third-party theming surface, covered in Theming below.
- `theme-light.css`: the roles on `:root`, the only names a component
  reads: `--surface`, `--ink`, `--rule`, `--on-ink`, `--ink-muted`,
  `--band`, `--hairline`, `--divider-faint`, `--well`, `--accent-1`,
  `--accent-1-ink`, `--accent-2`, `--accent-2-ink`, `--on-accent-1`,
  `--on-accent-2`, `--error-ink`, `--code-bg/fg/line`, the
  `--code-token-*` roles, `--veil`, `--mat-line`, `--track-x/y/z`, the
  `--panel-*` roles, `--focus-ring`, and `--stroke`.
- `theme-dark.css`: the same roles on `:root[data-theme="dark"]`,
  opt-in by attribute.

Ink and rule are separate roles even though the shipped theme gives
them one value each: text and fills read `--ink`; borders, outlines,
and the bracket frame's gradient stops read `--rule`. A theme override
can differ them without touching a component.

Hex values live under `tokens/` only; everywhere else uses
`var(--...)`. This is enforced by stylelint's `color-no-hex` rule (the
tokens files are the exception; see
`packages/tooling/src/stylelintrc.json`) and pinned for specific facts
by `packages/css/test/css-pins.test.ts`, such as both themes defining
`--focus-ring` and the retired names staying gone. A consumer can add
its own sweep the same way; this package's own suite pins only what
this repository's history has needed pinned.

### Lint

Whitespace and style are the tooling's job, never a hand pass. Prettier
settles line structure; the blank lines between blocks are eslint and
stylelint rules with fixers, since Prettier keeps the blank lines it
finds and never adds one. `npm run lint:fix` applies all of it in the
order that converges (Prettier, eslint, stylelint, Prettier again);
`npm run lint` gates it in CI.

- `npm run format:check`: Prettier at its defaults plus the Astro
  plugin (`@half-built/tooling`'s `prettier.config.mjs`), with
  `astroCompressHTML: "html"` (Astro 5's own default, kept explicit so
  a newline inside an element never renders as a space) and
  `embeddedLanguageFormatting: "off"` for `.astro` files, so a
  multi-line comment inside `<style>` is not re-indented on every pass.
- `npm run lint:css`: stylelint over `packages/*/src/**/*.{css,astro}`
  (`postcss-html` syntax for `.astro`). `color-no-hex` is the
  enforcement point for the hex rule above; its message points back at
  this section rather than at a document that does not ship.
- `npm run lint:js`: ESLint's flat config with `eslint-plugin-astro`;
  TypeScript files run at the type-checked strict tier. The preset also
  carries `@stylistic`'s `padding-line-between-statements`, autofixed
  by `eslint --fix`.

## Bottom-docked controls

`--dock-bottom` (in `tokens/primitives.css`, default `0px`) is the
room a viewport-fixed bottom component occupies. A site that pins a
control cluster to the bottom corner sets it to the cluster's height
plus its inset and a line of air, in the same media block that pins
the cluster; the astro package's `Footer` reserves that much below its
last link so the page scrolls on far enough to clear the cluster.

## Theming

The entire third-party theming surface is six primitives: two brand
families, three stops each. Override any or all of them in your
`site` layer; every other token in the system derives from these six.

| Variable | Default | Role |
|---|---|---|
| `--brand-1-500` | `#ffaa3c` | Base: lines and fills, dark-theme text ink. |
| `--brand-1-600` | `#d1820f` | Chart kin; light-theme track-x. |
| `--brand-1-700` | `#a36300` | Text ink on the light paper; light-theme focus ring. |
| `--brand-2-300` | `#8ee6f2` | Light kin: dark-theme text ink and track-y. |
| `--brand-2-500` | `#3cc7dd` | Base: lines and fills, dark-theme focus ring. |
| `--brand-2-700` | `#1a7f90` | Text ink on the light paper; light-theme track-y. |

An override looks like this:

```css
/* half-built palette override, generated at ui.half-built-robots.com */
:root {
  --brand-1-500: #3cc74a;
  --brand-1-600: #2a9c38;
  --brand-1-700: #1c6b27;
  --brand-2-300: #a0e8b0;
  --brand-2-500: #34b350;
  --brand-2-700: #1f7a38;
}
```

A derived ramp is built to three thresholds: the 700 stops clear 4.5:1
against white, the 300 stop clears 4.5:1 against `#111111`, and the
600 stop clears 3:1 against white. The shipped defaults clear all
three (the 600 stop was retuned to `#d1820f` for the 3:1 non-text
gate in 0.2.0). These are targets the derivation satisfies, not a
floor the system enforces on your behalf. If
you write your own six values instead of deriving them, you own their
contrast.

WCAG 1.4.11 covers non-text graphical objects (chart lines, focus
indicators) at 3:1, not just body text, so the light theme's own
roles use the 700 stops rather than the 500 base for the same reason
the 600 stop exists: `--focus-ring` resolves to `--brand-1-700` and
`--track-y` to `--brand-2-700`, and `--track-x` already used
`--brand-1-600`. The dark theme keeps the 500 and 300 stops, which
already clear the same gate on the dark ground.

The reference site generates a compliant block for you: give it two
base colors and its palette editor derives the other four stops and
prints a ready-to-paste override in exactly the shape above. It will
live at `ui.half-built-robots.com` once deployed; today the source for
that derivation is `site/src/lib/derive-palette.ts` in this repo.
