/* @half-built/tooling/palette: the accent-palette math behind the
   reference site's palette editor, for a consumer's build to derive
   a compliant ramp from two bases and assert its contrast. Pure
   functions over culori, no DOM, so it also runs in a browser bundle. */
export { contrastRatio } from "./contrast.ts";
export * from "./derive-palette.ts";
export * from "./grounds.ts";
