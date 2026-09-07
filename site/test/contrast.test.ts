import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { contrastRatio } from "../src/lib/contrast";
import { LIGHT_PAPER, DARK_GROUND, CODE_GROUND, CODE_LINE, CODE_FG, CODE_COMMENT } from "../src/lib/grounds";
import { derivePalette, SHIPPED_B1, SHIPPED_B2 } from "../src/lib/derive-palette";

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
    /* the code island's chrome, same in both themes */
    expect(light).toMatch(/--code-bg:\s*var\(--ink-900\)/);
    expect(dark).toMatch(/--code-bg:\s*var\(--ink-900\)/);
    expect(primitives).toContain(`--ink-900: ${CODE_GROUND}`);
    expect(primitives).toContain(`--ink-800: ${CODE_LINE}`);
    expect(primitives).toContain(`--parchment: ${CODE_FG}`);
    expect(primitives).toContain(`--umber-500: ${CODE_COMMENT}`);
  });

  it("the anchor's brand stops match the installed package's primitives", () => {
    /* SHIPPED_DEFAULTS re-states the package's brand ramp so the amber
       anchor short-circuits to shipped bytes; without this tripwire a
       package retune (the open comment-ink decision, for example)
       would leave the editor's defaults and its copyable block
       printing stale hexes while every suite stayed green. */
    const require = createRequire(import.meta.url);
    const pkgRoot = dirname(require.resolve("@half-built/css/package.json"));
    const primitives = readFileSync(join(pkgRoot, "src/tokens/primitives.css"), "utf8");
    const anchor = derivePalette(SHIPPED_B1, SHIPPED_B2);
    for (const [key, value] of Object.entries(anchor)) {
      if (!key.startsWith("--brand-")) continue;
      expect(primitives, `${key} drifted from the installed package`).toContain(`${key}: ${value}`);
    }
  });
});
