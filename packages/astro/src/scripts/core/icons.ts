/* Inline icon markup, vendored from Lucide (https://lucide.dev, ISC
   license), replacing the Unicode glyphs whose rendering varied by
   platform font. Same line style as the site's existing inline SVGs
   (the to-top chevron in Base.astro). Buttons carry their own
   aria-labels; the svg itself is decorative and aria-hidden.
   Home: the js package's core (owner decision 1, 2026-08-31); Lucide,
   ISC license, attribution retained. */

/* 1em sizing: icons track their button's font size instead of a fixed
   pixel box. */
/* pointer-events none: a click on a button must target the button, not
   the decorative svg. A targeted svg detached by an innerHTML swap
   mid-bubble made the plate-modal's veil check read a pause click as
   outside the zone and close the dialog (found 2026-08-23). */
const icon = (paths: string, fill = "none"): string =>
  `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="${fill}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" pointer-events="none" aria-hidden="true">${paths}</svg>`;

export const ICON_X = icon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>');
/* Play is the one filled icon: a stroke-only triangle reads as a hollow
   arrow, not a play control. */
export const ICON_PLAY = icon('<polygon points="7 4 19 12 7 20 7 4"/>', "currentColor");
/* The AI Art badge (CornerBadges.astro). */
export const ICON_SPARKLES = icon('<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>');
export const ICON_PAUSE = icon('<line x1="9" x2="9" y1="5" y2="19"/><line x1="15" x2="15" y1="5" y2="19"/>');
export const ICON_ROTATE_CCW = icon('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>');
export const ICON_CHEVRON_LEFT = icon('<path d="m15 18-6-6 6-6"/>');
export const ICON_CHEVRON_RIGHT = icon('<path d="m9 18 6-6-6-6"/>');
/* Day/night toggle in the header (owner request 2026-08-25). */
export const ICON_SUN = icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>');
export const ICON_MOON = icon('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>');
