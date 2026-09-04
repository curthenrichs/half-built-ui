import { defineConfig } from "astro/config";
import codeTheme from "@half-built/astro/shiki/code-theme";

// Kitchen-sink demo for the half-built packages. No adapter, no
// integrations beyond what a minimal static site needs: the point is
// that this builds using only package specifiers into @half-built/*.
export default defineConfig({
  output: "static",
  markdown: {
    shikiConfig: { theme: codeTheme },
  },
});
