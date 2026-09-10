/* Site identity for the public reference site. Kept separate from the
   content-inventory sample data, which is defined inline in
   index.astro, because Base.astro needs this on every page and the
   content data only on index.astro. */
import type { NavItem, SocialItem, SitemapGroup, EcosystemEntry } from "@half-built/astro/components/models.ts";
import { ECOSYSTEM_SELF_KEY } from "../lib/ecosystem-config";

export const SITE_NAME = "half-built-ui";
export const TAGLINE = "Every @half-built component on one page.";

/* A generic external-link glyph, not a brand mark: the social row just
   needs to show that icon markup renders, not to represent a real
   profile on a real network. */
const ICON_EXTERNAL =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7" /><path d="M8 7h9v9" /></svg>';

/* "Frame", not "Chrome": the browser wears that word (owner call
   2026-09-06). No Subscribe item: the widget renders in its own
   section, and this site has nothing to subscribe to (same call). */
export const NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Frame", href: "#frame" },
  { label: "Cards", href: "#cards" },
  { label: "Components", href: "#components" },
  { label: "CSS", href: "#css" },
];

export const SOCIALS: SocialItem[] = [
  { label: "Package source", href: "https://github.com/curthenrichs/half-built-ui", icon: ICON_EXTERNAL },
  { label: "Placeholder link", href: "https://example.com", icon: ICON_EXTERNAL },
];

/* The same holder the blog's footer names; the two lines must match. */
export const LEGAL_HOLDER = "Curt Henrichs LLC";

/* Site lists this page's sections, More points off the site (owner
   call 2026-09-06). Ecosystem is the Footer's own third column and
   comes from ECOSYSTEM below. */
export const FOOTER_SITEMAP: SitemapGroup[] = [
  {
    title: "Site",
    collapsible: true,
    phoneOpen: true,
    links: [
      { label: "About", href: "#intro" },
      { label: "Frame", href: "#frame" },
      { label: "Cards", href: "#cards" },
      { label: "Components", href: "#components" },
      { label: "CSS", href: "#css" },
    ],
  },
  {
    title: "More",
    collapsible: true,
    links: [
      { label: "Source on GitHub", href: "https://github.com/curthenrichs/half-built-ui" },
      { label: "@half-built/css", href: "https://www.npmjs.com/package/@half-built/css" },
      { label: "@half-built/astro", href: "https://www.npmjs.com/package/@half-built/astro" },
      { label: "@half-built/tooling", href: "https://www.npmjs.com/package/@half-built/tooling" },
    ],
  },
];

/* The satellite baseline (design record 2026-09-06-ecosystem-endpoint):
   this site plus a pointer home to the blog. The island replaces the
   list with the shared document at runtime; this is what renders with
   JavaScript off, during an outage, or before the endpoint exists.
   Two entries, so it cannot drift far from the truth. */
export const ECOSYSTEM: EcosystemEntry[] = [
  { key: "ui", label: SITE_NAME, href: "/" },
  { key: "blog", label: "Half-Built Robots", href: "https://half-built-robots.com/" },
];

/* One definition, in lib/ecosystem-config.ts, which the client script
   also reads. */
export const ECOSYSTEM_SELF = ECOSYSTEM_SELF_KEY;
