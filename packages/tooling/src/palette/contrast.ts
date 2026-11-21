/* WCAG 2.x contrast ratio between two colors, through culori's
   wcagContrast (same sRGB linearization and luminance weights the
   hand-rolled version used, so every ratio is unchanged). culori takes
   any CSS color, so the guard below keeps the old contract: a string
   it cannot parse throws instead of turning into NaN and quietly
   failing every threshold. */
import { parse, wcagContrast } from "culori";

export function contrastRatio(a: string, b: string): number {
  for (const c of [a, b]) {
    if (parse(c) === undefined) throw new Error(`unparseable color ${c}`);
  }

  return wcagContrast(a, b);
}
