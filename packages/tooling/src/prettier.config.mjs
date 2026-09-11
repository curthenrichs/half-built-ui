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
  overrides: [
    {
      files: "*.astro",
      options: {
        parser: "astro",
        // Astro 5's compressHTML default (true, the "html" mode) turns a
        // newline inside an element into one space, so a <slot /> or a
        // link's text broken onto its own line renders with spaces
        // around it. The plugin assumes Astro 7's jsx mode unless told,
        // and would introduce exactly that. Keep this in step with
        // compressHTML in astro.config.mjs.
        astroCompressHTML: "html",
        // The plugin's html mode re-indents the continuation lines of a
        // multi-line comment inside <style> on every pass, so a checked
        // tree could never settle. Leaving <style> and <script> bodies to
        // stylelint and eslint (their empty-line and padding rules) keeps
        // Prettier on the frontmatter and the template, where the
        // whitespace stakes are.
        embeddedLanguageFormatting: "off",
      },
    },
  ],
};
