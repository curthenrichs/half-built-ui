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
   identity it is handed, never a consumer's own config. NavItem is the
   shape a consumer's own site navigation config already used; it moved
   here so the component and the site share one definition without the
   component importing site code. SocialItem carries its icon as inline
   SVG markup: a site's own icon registry (including any site-specific
   brand glyphs that stay out of the package) is a lookup the caller
   performs, not the component. */
export interface NavItem {
  label: string;
  href: string;
  /* Open in a new tab (target and rel set, a hidden hint appended). */
  newTab?: boolean;
}

export interface SocialItem {
  /* Screen-reader text for the icon. */
  label: string;
  href: string;
  /* Inline SVG markup, rendered with set:html. */
  icon: string;
}

/* Footer view-models (step 9.5). These are the interfaces a consumer's
   own footer-sitemap comment called "the future component-library
   schema"; this is that move. A consumer's own footer data stays in its
   own config, not here. */
export interface SitemapLink {
  label: string;
  href: string;
  /* Open in a new tab (target and rel set, a hidden hint appended). */
  newTab?: boolean;
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
