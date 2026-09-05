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
