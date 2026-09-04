/* Sample site identity for the kitchen-sink demo. None of this is real
   copy: it exists only to give Masthead and Footer something typed to
   render. Kept separate from the content-inventory sample data, which
   is defined inline in index.astro, because Base.astro needs this on
   every page and the content data only on index.astro. */
import type { NavItem, SocialItem, SitemapGroup, EcosystemEntry } from "@half-built/astro/components/models";

export const SITE_NAME = "Kitchen Sink";
export const TAGLINE = "A demo site built only from @half-built packages.";

/* A generic external-link glyph, not a brand mark: the social row just
   needs to show that icon markup renders, not to represent a real
   profile on a real network. */
const ICON_EXTERNAL =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7" /><path d="M8 7h9v9" /></svg>';

export const NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Chrome", href: "#chrome" },
  { label: "Content", href: "#content" },
  { label: "Cards", href: "#cards" },
  { label: "Subscribe", href: "#subscribe" },
];

export const SOCIALS: SocialItem[] = [
  { label: "Package source", href: "https://github.com/curthenrichs/half-built-ui", icon: ICON_EXTERNAL },
  { label: "Placeholder link", href: "https://example.com", icon: ICON_EXTERNAL },
];

export const LEGAL_HOLDER = "Kitchen Sink Demo";

export const FOOTER_SITEMAP: SitemapGroup[] = [
  {
    title: "Site",
    collapsible: true,
    phoneOpen: true,
    links: [
      { label: "Home", href: "/" },
      { label: "Chrome", href: "#chrome" },
      { label: "Content", href: "#content" },
    ],
  },
  {
    title: "More",
    collapsible: true,
    links: [
      { label: "Cards", href: "#cards" },
      { label: "Subscribe", href: "#subscribe" },
    ],
  },
];

export const ECOSYSTEM: EcosystemEntry[] = [
  { key: "site", label: SITE_NAME, href: "/" },
  { key: "package", label: "half-built-ui (package source)", href: "https://github.com/curthenrichs/half-built-ui" },
];

export const ECOSYSTEM_SELF = "site";
