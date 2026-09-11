// Prettier preset shared across half-built packages and the sites that
// consume them: Prettier's own defaults (80 columns, double quotes,
// semicolons, trailing commas) plus the Astro plugin, so .astro files
// format the same way everywhere. The plugin is this package's own
// dependency and is handed over as an object rather than by name, so it
// resolves from here no matter where a consumer's config file lives.
//
// Prettier settles line structure only. It keeps the blank lines it
// finds and never adds one, so vertical whitespace is enforced by the
// eslint and stylelint presets next to this file, not here.
import * as astro from "prettier-plugin-astro";

export default {
  plugins: [astro],
  overrides: [{ files: "*.astro", options: { parser: "astro" } }],
};
