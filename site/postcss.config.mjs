/* PostCSS for every stylesheet Vite processes, Astro scoped styles
   included. postcss-global-data injects the package's @custom-media
   definitions (--bp-phone and friends) into each file's scope before
   postcss-custom-media resolves them, so a package component's scoped
   style can use --bp-phone without importing anything. The definitions
   are read through the package's own export path, never a relative
   reach into packages/css/src. */
import postcssGlobalData from "@csstools/postcss-global-data";
import postcssCustomMedia from "postcss-custom-media";
import { fileURLToPath } from "node:url";

const breakpoints = fileURLToPath(import.meta.resolve("@half-built/css/tokens/breakpoints.css"));

export default {
  plugins: [
    postcssGlobalData({ files: [breakpoints] }),
    postcssCustomMedia(),
  ],
};
