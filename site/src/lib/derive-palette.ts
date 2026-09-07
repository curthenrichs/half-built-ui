import { converter, clampChroma, formatHex } from "culori";
import { contrastRatio } from "./contrast";
import { LIGHT_PAPER, DARK_GROUND, CODE_GROUND, CODE_LINE, CODE_FG, CODE_COMMENT } from "./grounds";

const toOklch = converter("oklch");

/* Everything in this module is pure math over the reference constants
   above: no DOM, no site imports. That shape is deliberate (owner
   call 2026-09-06): the code island's theming is a package capability
   (the code-vars transformer and the --code-* roles ship in the
   packages), and this derivation lifts into @half-built/tooling at
   the registered 0.3.0 promotion without a rewrite. */
export interface PaletteOverride {
  "--brand-1-300": string;
  "--brand-1-500": string;
  "--brand-1-vivid": string;
  "--brand-1-600": string;
  "--brand-1-700": string;
  "--brand-2-300": string;
  "--brand-2-500": string;
  "--brand-2-700": string;
  "--code-bg": string;
  "--code-line": string;
  "--code-fg": string;
  "--code-token-comment": string;
}

export interface BaseReadout {
  darkTextRatio: number; /* base as text on DARK_GROUND */
  darkTextPasses: boolean; /* >= 4.5 */
  lightFillRatio: number; /* base as line or fill on LIGHT_PAPER */
  lightFillPasses: boolean; /* >= 3 */
}

/* Base 1 is also the code keyword ink (--code-token-keyword routes
   --brand-1-500), and the derived code ground is always lighter than
   DARK_GROUND, so a base can clear the dark-text gate and still miss
   4.5:1 on the code block. The extra readout closes that hole; base 2
   never renders on the code ground and needs none. */
export interface Base1Readout extends BaseReadout {
  codeTextRatio: number; /* base as keyword ink on its derived code ground */
  codeTextPasses: boolean; /* >= 4.5 */
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

/* Jump lightness by a fixed OKLCH delta with hue and chroma held
   (chroma clamped into gamut), the seed for the code kin below: the
   deltas are the shipped amber pair's own spacing (300 sits +0.08 L
   above the 500, vivid -0.12 below), so an arbitrary base gets kin
   with the same relative weight before the contrast walk applies. */
function shiftL(hex: string, dl: number): string {
  const start = toOklch(hex);
  if (start === undefined) throw new Error(`unparseable color ${hex}`);
  const l = Math.min(1, Math.max(0, start.l + dl));
  return formatHex(clampChroma({ ...start, l }, "oklch"));
}

/* The shipped default pair, and every stop the package ships for it.
   These were hand-tuned rather than walked, and they clear the
   thresholds below (one recorded exception: the comment ink sits at
   4.38:1, an open owner decision in the live-code-colors spec), so
   the default pair reproduces them exactly instead of returning a
   near-miss derivation that would visibly differ from the tokens the
   package actually ships. */
/* Exported as the one definition of the anchor pair; the editor's
   reset and the toolbar's initial markup consume these rather than
   keeping copies that can drift. */
export const SHIPPED_B1 = "#ffaa3c";
export const SHIPPED_B2 = "#3cc7dd";
const SHIPPED_DEFAULTS: PaletteOverride = {
  "--brand-1-300": "#ffd18a",
  "--brand-1-500": "#ffaa3c",
  "--brand-1-vivid": "#e07c14",
  "--brand-1-600": "#d1820f",
  "--brand-1-700": "#a36300",
  "--brand-2-300": "#8ee6f2",
  "--brand-2-500": "#3cc7dd",
  "--brand-2-700": "#1a7f90",
  "--code-bg": CODE_GROUND,
  "--code-line": CODE_LINE,
  "--code-fg": CODE_FG,
  "--code-token-comment": CODE_COMMENT,
};

/* Re-hue a reference value to the base's hue, exact OKLCH lightness
   and chroma held (chroma clamped for the new hue's gamut). An
   achromatic base has no hue to give, so the reference keeps its
   own. */
function hueSwap(ref: string, base: string): string {
  const r = toOklch(ref);
  const b = toOklch(base);
  if (r === undefined || b === undefined) throw new Error(`unparseable color ${ref} or ${base}`);
  return formatHex(clampChroma({ ...r, h: b.h ?? r.h }, "oklch"));
}

/* The code island's chrome follows accent 1's hue (owner call
   2026-09-06): every one of its amber "neutrals" is a low-chroma
   amber (hue 70 to 78 against the accent's 68.5), so a fixed island
   under a strong override read as a leftover of the old palette. The
   two values that are text walk lighter until they read against the
   derived ground; OKLCH lightness is not WCAG luminance, so holding
   L alone does not guarantee the ratio survives the hue swap. */
interface CodeChrome {
  "--code-bg": string;
  "--code-line": string;
  "--code-fg": string;
  "--code-token-comment": string;
}

function deriveCodeChrome(b1: string): CodeChrome {
  const bg = hueSwap(CODE_GROUND, b1);
  return {
    "--code-bg": bg,
    "--code-line": hueSwap(CODE_LINE, b1),
    "--code-fg": walk(hueSwap(CODE_FG, b1), 1, (c) => contrastRatio(c, bg) >= 4.5),
    "--code-token-comment": walk(hueSwap(CODE_COMMENT, b1), 1, (c) => contrastRatio(c, bg) >= 4.5),
  };
}

/* The code kin (spec 2026-09-06): 300 is the light kin the code theme
   uses for functions, vivid the deep saturated kin for strings. Both
   are code text, so both walk lighter until they read against the
   derived code ground; the seed jump keeps them distinct from the
   base rather than converging on the first passing value. The
   shipped amber kin shifted hue as well (hand-tuned, +10 and -11
   degrees), which the hue-holding walk cannot reproduce; the anchor
   short-circuit above covers them the way it covers the other
   hand-tuned stops. */
function deriveCodeKin(b1: string, codeBg: string): Pick<PaletteOverride, "--brand-1-300" | "--brand-1-vivid"> {
  return {
    "--brand-1-300": walk(shiftL(b1, 0.08), 1, (c) => contrastRatio(c, codeBg) >= 4.5),
    "--brand-1-vivid": walk(shiftL(b1, -0.12), 1, (c) => contrastRatio(c, codeBg) >= 4.5),
  };
}

export function derivePalette(base1: string, base2: string): PaletteOverride {
  const b1 = normalize(base1);
  const b2 = normalize(base2);
  if (b1 === normalize(SHIPPED_B1) && b2 === normalize(SHIPPED_B2)) {
    return { ...SHIPPED_DEFAULTS };
  }
  const chrome = deriveCodeChrome(b1);
  return {
    ...chrome,
    ...deriveCodeKin(b1, chrome["--code-bg"]),
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
): { base1: Base1Readout; base2: BaseReadout } {
  const b1 = normalize(base1);
  /* The same anchor-aware path derivePalette takes, so the readout is
     computed against the ground the page will actually paint. */
  const codeBg = b1 === normalize(SHIPPED_B1) ? CODE_GROUND : deriveCodeChrome(b1)["--code-bg"];
  const codeTextRatio = contrastRatio(b1, codeBg);
  return {
    base1: {
      ...readBase(base1),
      codeTextRatio,
      codeTextPasses: codeTextRatio >= 4.5,
    },
    base2: readBase(base2),
  };
}

/* Family 1 in lightness order (vivid sits between the 500 and the
   600), then family 2, then the code island's chrome roles. Exported
   as the one definition of the override surface; the editor applies
   and resets exactly these keys. */
export const RAMP_ORDER: (keyof PaletteOverride)[] = [
  "--brand-1-300",
  "--brand-1-500",
  "--brand-1-vivid",
  "--brand-1-600",
  "--brand-1-700",
  "--brand-2-300",
  "--brand-2-500",
  "--brand-2-700",
  "--code-bg",
  "--code-line",
  "--code-fg",
  "--code-token-comment",
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
