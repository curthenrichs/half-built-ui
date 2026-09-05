import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { contrastRatio } from "../src/lib/contrast";
import { LIGHT_PAPER, DARK_GROUND } from "../src/lib/grounds";

describe("contrastRatio", () => {
  it("matches WCAG reference values", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    /* the a11y lesson this system was tuned around */
    expect(contrastRatio("#a36300", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#b5680c", "#ffffff")).toBeLessThan(4.5);
  });
});

describe("grounds", () => {
  it("match the installed css package's surface values", () => {
    const require = createRequire(import.meta.url);
    const pkgRoot = dirname(require.resolve("@half-built/css/package.json"));
    const primitives = readFileSync(join(pkgRoot, "src/tokens/primitives.css"), "utf8");
    const light = readFileSync(join(pkgRoot, "src/tokens/theme-light.css"), "utf8");
    const dark = readFileSync(join(pkgRoot, "src/tokens/theme-dark.css"), "utf8");
    expect(light).toMatch(/--surface:\s*var\(--white\)/);
    expect(dark).toMatch(/--surface:\s*var\(--black-900\)/);
    expect(primitives).toContain(`--white: ${LIGHT_PAPER}`);
    expect(primitives).toContain(`--black-900: ${DARK_GROUND}`);
  });
});
