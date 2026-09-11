/* View-model types for the chrome components (step 6, 2026-08-30).
   These live with the components, not in lib/: the components are the
   future @half-built/astro package and must not import site code. The
   CollectionEntry mapping that produces them is src/lib/view-models.ts,
   which stays site-side. */
import type { ImageMetadata } from "astro";
import type { Badge } from "../scripts/core/badges";

export interface PostCardModel {
  href: string;
  title: string;
  excerpt: string;
  author: string;
  dateStr: string;
  minutes: number;
  hero: ImageMetadata;
  heroPosition?: string;
  draft?: boolean;
  badges?: Badge[];
  categories: { name: string; href: string }[];
}

export interface PostRef {
  href: string;
  title: string;
}

export interface LinkListItem {
  label: string;
  href: string;
  count?: number;
}

/* Chrome view-models (step 9.5, 2026-08-31): the header renders site
   identity it is handed, never the blog's config. NavItem is the shape
   config.ts's NAV already had; it moved here so the component and the
   site share one definition without the component importing site code.
   SocialItem carries its icon as inline SVG markup: the site's registry
   (social-icons.ts, including the Henry portfolio glyph that stays out
   of the package) is a lookup the caller performs, not the component. */
export interface NavItem {
  label: string;
  href: string;
}

export interface SocialItem {
  /* Screen-reader text for the icon. */
  label: string;
  href: string;
  /* Inline SVG markup, rendered with set:html. */
  icon: string;
}

/* Footer view-models (step 9.5). These are the interfaces config.ts's
   footer-sitemap comment always called "the future component-library
   schema"; this is that move. The blog's data (FOOTER_SITEMAP,
   ECOSYSTEM) stays in config.ts. */
export interface SitemapLink {
  label: string;
  href: string;
}

export interface SitemapGroup {
  title: string;
  links: SitemapLink[];
  /* Collapsible on phones (a <details>, always open on wider screens). */
  collapsible?: boolean;
  /* A collapsible group starts closed on phones unless this is set. */
  phoneOpen?: boolean;
}

export interface EcosystemEntry {
  key: string;
  label: string;
  /* null: property not deployed yet; renders visible but unlinked. */
  href: string | null;
}
