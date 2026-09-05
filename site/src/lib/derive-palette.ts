import { converter, clampChroma, formatHex } from "culori";
import { contrastRatio } from "./contrast";
import { LIGHT_PAPER, DARK_GROUND } from "./grounds";

const toOklch = converter("oklch");

export interface PaletteOverride {
  "--brand-1-500": string;
  "--brand-1-600": string;
  "--brand-1-700": string;
  "--brand-2-300": string;
  "--brand-2-500": string;
  "--brand-2-700": string;
}

export interface BaseReadout {
  darkTextRatio: number; /* base as text on DARK_GROUND */
  darkTextPasses: boolean; /* >= 4.5 */
  lightFillRatio: number; /* base as line or fill on LIGHT_PAPER */
  lightFillPasses: boolean; /* >= 3 */
}

/* Walk lightness in OKLCH, hue held, chroma clamped into gamut per
   step, until the candidate clears `passes`. Extremes are the
   backstop: pure black or white always clears these thresholds
   against the opposite ground. */
function walk(hex: string, dir: -1 | 1, passes: (c: string) => boolean): string {
  const start = toOklch(hex);
  if (start === undefined) throw new Error(`unparseable color ${hex}`);
  for (let l = start.l; l >= 0 && l <= 1; l += dir * 0.005) {
    const hexAtL = formatHex(clampChroma({ ...start, l }, "oklch"));
    if (passes(hexAtL)) return hexAtL;
  }
  return dir === -1 ? "#000000" : "#ffffff";
}

/* Normalize any parseable color string to a 6-digit lowercase hex,
   routed through the same OKLCH gamut clamp as `walk` so the 500
   stops are directly comparable to the ramps derived from them. */
function normalize(hex: string): string {
  const start = toOklch(hex);
  if (start === undefined) throw new Error(`unparseable color ${hex}`);
  return formatHex(clampChroma(start, "oklch"));
}

export function derivePalette(base1: string, base2: string): PaletteOverride {
  const b1 = normalize(base1);
  const b2 = normalize(base2);
  return {
    "--brand-1-500": b1,
    "--brand-1-600": walk(b1, -1, (c) => contrastRatio(c, LIGHT_PAPER) >= 3),
    "--brand-1-700": walk(b1, -1, (c) => contrastRatio(c, LIGHT_PAPER) >= 4.5),
    "--brand-2-300": walk(b2, 1, (c) => contrastRatio(c, DARK_GROUND) >= 4.5),
    "--brand-2-500": b2,
    "--brand-2-700": walk(b2, -1, (c) => contrastRatio(c, LIGHT_PAPER) >= 4.5),
  };
}

function readBase(base: string): BaseReadout {
  const darkTextRatio = contrastRatio(base, DARK_GROUND);
  const lightFillRatio = contrastRatio(base, LIGHT_PAPER);
  return {
    darkTextRatio,
    darkTextPasses: darkTextRatio >= 4.5,
    lightFillRatio,
    lightFillPasses: lightFillRatio >= 3,
  };
}

export function readBases(
  base1: string,
  base2: string,
): { base1: BaseReadout; base2: BaseReadout } {
  return { base1: readBase(base1), base2: readBase(base2) };
}

const RAMP_ORDER: (keyof PaletteOverride)[] = [
  "--brand-1-500",
  "--brand-1-600",
  "--brand-1-700",
  "--brand-2-300",
  "--brand-2-500",
  "--brand-2-700",
];

export function overrideBlock(p: PaletteOverride): string {
  const lines = RAMP_ORDER.map((key) => `  ${key}: ${p[key]};`);
  return [
    "/* half-built palette override, generated at ui.half-built-robots.com */",
    ":root {",
    ...lines,
    "}",
  ].join("\n");
}
