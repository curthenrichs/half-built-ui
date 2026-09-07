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
`path-player.css`) load the same way, from whichever layout or
component mounts their island. The `.` entry is the base layer (reset,
shell, link-tip, scroll-top); it is not the whole system, which is why
the explicit order above exists.

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

## Theming

The entire third-party theming surface is six primitives: two brand
families, three stops each. Override any or all of them in your
`site` layer; every other token in the system derives from these six.

| Variable | Default | Role |
|---|---|---|
| `--brand-1-500` | `#ffaa3c` | Base: lines and fills, dark-theme text ink, light-theme focus ring. |
| `--brand-1-600` | `#d1820f` | Chart kin; light-theme track-x. |
| `--brand-1-700` | `#a36300` | Text ink on the light paper. |
| `--brand-2-300` | `#8ee6f2` | Light kin: dark-theme text ink and track-y. |
| `--brand-2-500` | `#3cc7dd` | Base: lines and fills, dark-theme focus ring. |
| `--brand-2-700` | `#1a7f90` | Text ink on the light paper. |

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

The reference site generates a compliant block for you: give it two
base colors and its palette editor derives the other four stops and
prints a ready-to-paste override in exactly the shape above. It will
live at `ui.half-built-robots.com` once deployed; today the source for
that derivation is `site/src/lib/derive-palette.ts` in this repo.
