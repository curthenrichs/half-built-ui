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
export const CODE_LINE = "#3b2e1e";
export const CODE_FG = "#e8d9c3";
export const CODE_COMMENT = "#8a7a63";
