/* Pins for the verbatim move (step 11.3 task 2): concrete facts the
   brief calls out so a later edit to these files trips a test instead
   of silently drifting. Not a re-test of the blog's own suite, which
   stays behind in half-built-robots-blog. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf-8");

describe("css pins", () => {
  it("both themes define --focus-ring", () => {
    expect(read("../src/tokens/theme-light.css")).toMatch(/--focus-ring:/);
    expect(read("../src/tokens/theme-dark.css")).toMatch(/--focus-ring:/);
  });

  it("primitives define --z-tooltip and the shared amber accent", () => {
    const prims = read("../src/tokens/primitives.css");
    expect(prims).toMatch(/--z-tooltip:/);
    expect(prims).toMatch(/--brand-1-500: #ffaa3c;/);
  });

  it("breakpoints.css defines the four system breakpoint names", () => {
    const bp = read("../src/tokens/breakpoints.css");
    for (const name of ["--bp-phone", "--bp-phone-up", "--bp-sidebar", "--bp-tablet"]) {
      expect(bp, name).toMatch(new RegExp(`@custom-media ${name} `));
    }
  });

  it("prose never caps width (standing owner rule; the only max-width is the img fit)", () => {
    const css = read("../src/prose.css");
    const hits = [...css.matchAll(/max-width[^;]*;/g)].map((m) => m[0]);
    expect(hits).toEqual(["max-width: 100%;"]);
    expect(css).not.toMatch(/\bch\b/);
  });

  it("link-tip hides under the hover-none backstop", () => {
    const css = read("../src/base/link-tip.css");
    const backstopMatch = /@media \(hover: none\) \{\s*\.link-tip \{ display: none; \}/.exec(css);
    expect(backstopMatch).not.toBeNull();
  });
});
