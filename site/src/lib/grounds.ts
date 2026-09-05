/* The two grounds derivation targets. Constants, not runtime reads,
   because only the active theme's values are computed in the browser;
   contrast.test.ts asserts they match the installed package, so they
   cannot go stale silently. */
export const LIGHT_PAPER = "#ffffff";
export const DARK_GROUND = "#111111";
