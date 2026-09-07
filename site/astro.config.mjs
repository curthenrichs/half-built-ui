import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import codeTheme from "@half-built/astro/shiki/code-theme";

// Kitchen-sink demo for the half-built packages. No adapter, and no
// integrations beyond what a minimal static site needs: the point is
// that this builds using only package specifiers into @half-built/*.
// Sitemap qualifies. This is a fresh subdomain with no inbound links,
// and a sitemap plus a Search Console submission is the fastest route
// to being indexed at all. It also matches the blog's setup.
//
// `site` is not optional here. The sitemap integration requires it,
// and Base.astro's canonical and og:url tags resolve against it.
// Subdomains are separate hosts to a crawler, so this site carries its
// own sitemap rather than appearing in the blog's; what actually links
// the two is the footer's ecosystem entry.
export default defineConfig({
  site: "https://ui.half-built-robots.com",
  output: "static",
  markdown: {
    shikiConfig: { theme: codeTheme },
  },
  integrations: [sitemap()],
});
