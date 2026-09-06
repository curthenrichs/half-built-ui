import { describe, it, expect } from "vitest";
import { contrastRatio } from "../src/lib/contrast";
import { LIGHT_PAPER, DARK_GROUND } from "../src/lib/grounds";
import { derivePalette, readBases, overrideBlock, type PaletteOverride } from "../src/lib/derive-palette";

const HEX_RE = /^#[0-9a-f]{6}$/;

describe("derivePalette", () => {
  it("returns exactly the shipped defaults for the amber/cyan anchor, and they clear the contrast gates", () => {
    const p = derivePalette("#ffaa3c", "#3cc7dd");
    expect(p).toEqual({
      "--brand-1-300": "#ffd18a",
      "--brand-1-500": "#ffaa3c",
      "--brand-1-vivid": "#e07c14",
      "--brand-1-600": "#d1820f",
      "--brand-1-700": "#a36300",
      "--brand-2-300": "#8ee6f2",
      "--brand-2-500": "#3cc7dd",
      "--brand-2-700": "#1a7f90",
      "--code-bg": "#1b140c",
      "--code-line": "#3b2e1e",
      "--code-fg": "#e8d9c3",
      "--code-token-comment": "#8a7a63",
    });
    expect(contrastRatio(p["--brand-1-700"], LIGHT_PAPER)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p["--brand-2-700"], LIGHT_PAPER)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p["--brand-2-300"], DARK_GROUND)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p["--brand-1-600"], LIGHT_PAPER)).toBeGreaterThanOrEqual(3);
    /* code text reads against the derived code ground */
    expect(contrastRatio(p["--brand-1-300"], p["--code-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p["--brand-1-vivid"], p["--code-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p["--code-fg"], p["--code-bg"])).toBeGreaterThanOrEqual(4.5);
    /* the shipped comment ink is hand-tuned legacy at 4.38:1, under
       the 4.5 gate the walk enforces for every derived palette; the
       anchor keeps its bytes (parity), and the retune is an open
       owner decision recorded in the live-code-colors spec. */
    expect(contrastRatio(p["--code-token-comment"], p["--code-bg"])).toBeGreaterThanOrEqual(4.3);
    /* the two 500 stops echo the inputs */
    expect(contrastRatio(p["--brand-1-500"], "#ffaa3c")).toBeCloseTo(1, 5);
    expect(contrastRatio(p["--brand-2-500"], "#3cc7dd")).toBeCloseTo(1, 5);
  });

  it("clears the contrast gates for a green pair", () => {
    const p = derivePalette("#2f9e44", "#0ca678");
    expect(contrastRatio(p["--brand-1-700"], LIGHT_PAPER)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p["--brand-2-700"], LIGHT_PAPER)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p["--brand-2-300"], DARK_GROUND)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p["--brand-1-600"], LIGHT_PAPER)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(p["--brand-1-300"], p["--code-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p["--brand-1-vivid"], p["--code-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p["--code-fg"], p["--code-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p["--code-token-comment"], p["--code-bg"])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p["--brand-1-500"], "#2f9e44")).toBeCloseTo(1, 5);
    expect(contrastRatio(p["--brand-2-500"], "#0ca678")).toBeCloseTo(1, 5);
  });

  it("still clears every threshold for near-white and near-black pathological bases", () => {
    const pairs: [string, string][] = [
      ["#fefefe", "#f0f0ff"],
      ["#050505", "#fefefe"],
      ["#fefefe", "#050505"],
      ["#050505", "#050505"],
    ];
    for (const [base1, base2] of pairs) {
      const p = derivePalette(base1, base2);
      expect(contrastRatio(p["--brand-1-700"], LIGHT_PAPER)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p["--brand-2-700"], LIGHT_PAPER)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p["--brand-2-300"], DARK_GROUND)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p["--brand-1-600"], LIGHT_PAPER)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(p["--brand-1-300"], p["--code-bg"])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p["--brand-1-vivid"], p["--code-bg"])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p["--code-fg"], p["--code-bg"])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p["--code-token-comment"], p["--code-bg"])).toBeGreaterThanOrEqual(4.5);
      for (const value of Object.values(p)) {
        expect(value).toMatch(HEX_RE);
      }
    }
  });

  it("is deterministic", () => {
    const a = derivePalette("#ffaa3c", "#3cc7dd");
    const b = derivePalette("#ffaa3c", "#3cc7dd");
    expect(a).toEqual(b);
  });
});

describe("readBases", () => {
  it("reports both bases passing against the amber/cyan anchor", () => {
    const r = readBases("#ffaa3c", "#3cc7dd");
    expect(r.base1.darkTextPasses).toBe(true);
    expect(r.base2.darkTextPasses).toBe(true);
  });

  it("reports a failing base against DARK_GROUND", () => {
    const r = readBases("#104020", "#0a2a40");
    expect(r.base1.darkTextPasses).toBe(false);
  });
});

describe("overrideBlock", () => {
  it("emits every property once, in ramp order, as parseable css lines", () => {
    const p: PaletteOverride = derivePalette("#ffaa3c", "#3cc7dd");
    const block = overrideBlock(p);
    const order = [
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
    ] as const;

    for (const name of order) {
      const re = new RegExp(`${name}:\\s*${p[name]};`);
      expect(block).toMatch(re);
      const count = block.split(`${name}:`).length - 1;
      expect(count).toBe(1);
    }

    const seenOrder = order.filter((name) => block.includes(`${name}:`));
    expect(seenOrder).toEqual(order);

    const propertyLine = /^\s*(--(?:brand-[12]-(?:\d{3}|vivid)|code-(?:bg|line|fg|token-comment))):\s*(#[0-9a-f]{6});$/;
    const lines = block.split("\n").filter((line) => propertyLine.test(line));
    expect(lines).toHaveLength(12);
    for (const line of lines) {
      const m = propertyLine.exec(line);
      expect(m).not.toBeNull();
    }
  });

  it("starts with the generated-at comment and wraps a :root block", () => {
    const p = derivePalette("#ffaa3c", "#3cc7dd");
    const block = overrideBlock(p);
    expect(block).toMatch(/^\/\* half-built palette override, generated at ui\.half-built-robots\.com \*\//);
    expect(block).toContain(":root {");
    expect(block.trim().endsWith("}")).toBe(true);
  });
});
