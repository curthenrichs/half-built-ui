/* Inline icon markup, vendored from Lucide (https://lucide.dev, ISC
   license), replacing the Unicode glyphs whose rendering varied by
   platform font. Same line style as the site's existing inline SVGs
   (the to-top chevron in Base.astro). Buttons carry their own
   aria-labels; the svg itself is decorative and aria-hidden.
   Home: the js package's core (owner decision 1, 2026-08-31); Lucide,
   ISC license, attribution retained. */

interface Glyph {
  paths: string;
  fill?: string;
}

/* Every glyph the package draws, keyed by its Lucide name. Components
   render one through Icon.astro; client scripts take the ICON_*
   strings below. Add a glyph here, never as inline <svg> markup in a
   component (test/icons.test.ts guards that). */
const GLYPHS = {
  x: { paths: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>' },
  /* Play is the one filled icon: a stroke-only triangle reads as a hollow
     arrow, not a play control. */
  play: {
    paths: '<polygon points="7 4 19 12 7 20 7 4"/>',
    fill: "currentColor",
  },
  /* The AI Art badge (CornerBadges.astro). */
  sparkles: {
    paths:
      '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
  },
  pause: {
    paths:
      '<line x1="9" x2="9" y1="5" y2="19"/><line x1="15" x2="15" y1="5" y2="19"/>',
  },
  "rotate-ccw": {
    paths:
      '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  },
  "chevron-left": { paths: '<path d="m15 18-6-6 6-6"/>' },
  /* Pagination's previous and next (Pagination.astro): arrows, not
     chevrons, which read too faint in a 30px box. */
  "arrow-left": { paths: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>' },
  "arrow-right": { paths: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>' },
  "chevron-right": { paths: '<path d="m9 18 6-6-6-6"/>' },
  /* The to-top link (Shell.astro). */
  "chevron-up": { paths: '<path d="m18 15-6-6-6 6"/>' },
  /* Day/night toggle in the header (owner request 2026-08-25). */
  sun: {
    paths:
      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  },
  moon: { paths: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>' },
  /* The header's search button (SiteHeader.astro) and the post card's
     meta row (PostCard.astro). These replaced Font Awesome glyphs that
     had been inlined in the templates (owner call 2026-09-10), which
     also puts every glyph the package ships under the one
     ICONS-LICENSE. */
  search: {
    paths: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  },
  clock: { paths: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>' },
  user: {
    paths:
      '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  },
  calendar: {
    paths:
      '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>',
  },
  circle: { paths: '<circle cx="12" cy="12" r="10"/>' },
} as const satisfies Record<string, Glyph>;

export type IconName = keyof typeof GLYPHS;

export interface IconOptions {
  /* A CSS length, or a pixel count. The default tracks the parent's
     font size. */
  size?: number | string;
  strokeWidth?: number;
  class?: string;
}

/* 1em sizing: icons track their button's font size instead of a fixed
   pixel box. */
/* pointer-events none: a click on a button must target the button, not
   the decorative svg. A targeted svg detached by an innerHTML swap
   mid-bubble made the plate-modal's veil check read a pause click as
   outside the zone and close the dialog (found 2026-08-23). */
export function iconMarkup(
  name: IconName,
  { size = "1em", strokeWidth = 2.5, class: className }: IconOptions = {},
): string {
  const glyph: Glyph = GLYPHS[name];
  const dim = typeof size === "number" ? String(size) : size;
  const cls = className === undefined ? "" : ` class="${className}"`;
  return `<svg${cls} viewBox="0 0 24 24" width="${dim}" height="${dim}" fill="${glyph.fill ?? "none"}" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" pointer-events="none" aria-hidden="true">${glyph.paths}</svg>`;
}

export const ICON_X = iconMarkup("x");
export const ICON_PLAY = iconMarkup("play");
export const ICON_SPARKLES = iconMarkup("sparkles");
export const ICON_PAUSE = iconMarkup("pause");
export const ICON_ROTATE_CCW = iconMarkup("rotate-ccw");
export const ICON_CHEVRON_LEFT = iconMarkup("chevron-left");
export const ICON_CHEVRON_RIGHT = iconMarkup("chevron-right");
export const ICON_SUN = iconMarkup("sun");
export const ICON_MOON = iconMarkup("moon");
