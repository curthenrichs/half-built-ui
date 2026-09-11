// Flat ESLint config: JS/TS plus Astro component linting, shared across
// half-built packages and any site that consumes them. Adapted from the
// half-built-robots-blog repo's eslint.config.mjs (step 11.3 task 5):
// the blog-only ignores (.superpowers/, .claude/, .visual-check/, the
// vendored fluid-sim.js exemption) are gone, since none of that exists
// outside the blog, and the file-scoped overrides below are widened from
// root-anchored globs to "**/"-prefixed ones so they still find
// scripts/, test/, and src/pages/ wherever a package or site nests them
// in this monorepo, not only at repo root.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginAstro from "eslint-plugin-astro";
import globals from "globals";
import stylistic from "@stylistic/eslint-plugin";

export default tseslint.config(
  { ignores: ["**/dist/", "**/node_modules/", "**/.astro/", "**/public/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Type-checked strict tier for real TypeScript (libs, tests, config).
    // Astro virtual scripts and .mjs tooling stay on recommended: typed
    // linting needs the project service, which does not cover them.
    files: ["**/*.ts"],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        // Not import.meta.dirname: the blog's original pinned this to
        // wherever eslint.config.mjs itself lived, which was correct for
        // a single-repo config at the repo root but breaks the moment
        // this config ships in a package. import.meta.dirname would then
        // resolve inside node_modules/@half-built/tooling/src, and
        // TypeScript's project service treats that as an upper bound: it
        // will not walk up past it looking for a consumer's tsconfig.json,
        // so every consumer's typed linting would silently fail (and, in
        // this repo, so does packages/tooling's own test-kit, since
        // its tsconfig.json sits one directory above this file). cwd is
        // wherever eslint was invoked from, which for a shared preset is
        // the actual project root every time.
        tsconfigRootDir: process.cwd(),
      },
    },
    rules: {
      // Numbers interpolate into template literals losslessly; forbidding
      // them buys String() noise, not safety.
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
    },
  },
  ...eslintPluginAstro.configs.recommended,
  {
    // Vertical whitespace is a lint concern, not a Prettier one: Prettier
    // keeps the blank lines it finds and never adds any, so the breathing
    // room between blocks is enforced (and autofixed) here. The policy
    // opens structural boundaries: a blank line after the import block
    // and after directives, around declarations of interfaces, types,
    // enums, classes, functions, and exports, and around any statement
    // that spans several lines. One-line statements may still sit
    // together, and runs of one-line type aliases or re-exports may too.
    // Later entries override earlier ones, so the "any" relaxations come
    // last. Astro frontmatter is a Program to the astro parser, so this
    // reaches component frontmatter and <script> blocks as well.
    plugins: { "@stylistic": stylistic },
    rules: {
      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "any", prev: "import", next: "import" },
        { blankLine: "always", prev: "directive", next: "*" },
        { blankLine: "any", prev: "directive", next: "directive" },
        {
          blankLine: "always",
          prev: "*",
          next: ["interface", "type", "enum", "class", "function", "export"],
        },
        {
          blankLine: "always",
          prev: ["interface", "type", "enum", "class", "function", "export"],
          next: "*",
        },
        {
          blankLine: "always",
          prev: "*",
          next: [
            "multiline-const",
            "multiline-let",
            "multiline-expression",
            "multiline-block-like",
          ],
        },
        {
          blankLine: "always",
          prev: [
            "multiline-const",
            "multiline-let",
            "multiline-expression",
            "multiline-block-like",
          ],
          next: "*",
        },
        { blankLine: "any", prev: "type", next: "type" },
        { blankLine: "any", prev: "export", next: "export" },
      ],
    },
  },
  {
    files: ["**/scripts/**/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // This file itself: it reads process.cwd() above, and any consumer's
    // eslint.config.mjs that imports this preset runs in Node too.
    files: ["**/eslint.config.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["**/test/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Astro endpoints run at build time in Node with the web Response global.
    files: ["**/src/pages/**/*.js"],
    languageOptions: { globals: { ...globals.node, Response: "readonly" } },
  },
  {
    // Client-side <script> blocks inside Astro components run in the browser.
    files: ["**/*.astro/*.js", "**/*.astro/*.ts", "**/src/pages/**/*.astro"],
    languageOptions: { globals: { ...globals.browser } },
  },
);
