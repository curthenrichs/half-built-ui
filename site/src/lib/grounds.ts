/* The grounds derivation targets. Constants, not runtime reads,
   because only the active theme's values are computed in the browser;
   contrast.test.ts asserts they match the installed package, so they
   cannot go stale silently. CODE_GROUND is the code island's warm
   dark block (--code-bg routes --ink-900), the same in both themes,
   where the derived code kin must read as text. */
export const LIGHT_PAPER = "#ffffff";
export const DARK_GROUND = "#111111";
export const CODE_GROUND = "#1b140c";
