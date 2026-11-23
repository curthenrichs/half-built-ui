/* The grounds derivation targets. Constants, not runtime reads,
   because only the active theme's values are computed in the browser;
   contrast.test.ts asserts they match the installed package, so they
   cannot go stale silently. CODE_GROUND is the code island's warm
   dark block (--code-bg routes --ink-900), the same in both themes,
   where the derived code kin must read as text. */
export const LIGHT_PAPER = "#ffffff";
export const DARK_GROUND = "#111111";
export const CODE_GROUND = "#1b140c";

/* The rest of the code island's chrome (owner call 2026-09-06: the
   whole island follows accent 1's hue under an override, because
   every one of these "neutrals" is in truth a low-chroma amber).
   These are the amber reference values the hue swap starts from;
   contrast.test.ts pins each to the installed package. */
/* The strongest accent tint the packages paint under text: the 14%
   hover grounds (color-mix of an accent into the surface). The light
   text stops walk until they hold AA on this ground as well as on
   paper, and tint-contrast.test.ts holds every tint in the CSS at or
   under it. */
export const TINT_MAX = 0.14;

/* `color-mix(in srgb, color share, ground)` as a hex: a straight blend
   of the gamma-encoded channels, which is what in srgb mixing does. */
export function tintGround(
  color: string,
  ground: string,
  share: number,
): string {
  const channels = (hex: string): number[] =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

  const g = channels(ground);

  return `#${channels(color)
    .map((c, i) =>
      Math.round(c * share + g[i] * (1 - share))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export const CODE_LINE = "#3b2e1e";
export const CODE_FG = "#e8d9c3";
export const CODE_COMMENT = "#8e7e67";
