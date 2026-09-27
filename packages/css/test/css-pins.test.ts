/* Pins for the verbatim move (step 11.3 task 2): concrete facts the
   brief calls out so a later edit to these files trips a test instead
   of silently drifting. Not a re-test of the blog's own suite, which
   stays behind in half-built-robots-blog. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf-8");

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

    for (const name of [
      "--bp-phone",
      "--bp-phone-up",
      "--bp-sidebar",
      "--bp-tablet",
    ]) {
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

    const backstopMatch =
      /@media \(hover: none\) \{\s*\.link-tip \{\s*display: none;\s*\}/.exec(
        css,
      );

    expect(backstopMatch).not.toBeNull();
  });

  it("the popout sits over scroll-top and under the link tip", () => {
    const prims = read("../src/tokens/primitives.css");

    const z = (name: string): number =>
      Number(new RegExp(`--${name}: (\\d+);`).exec(prims)?.[1] ?? NaN);

    expect(z("z-popout")).toBeGreaterThan(z("z-scroll-top"));
    expect(z("z-popout")).toBeLessThan(z("z-tooltip"));
  });

  it("popout.css carries both modes, the scroll lock, and the reduced-motion guard", () => {
    const css = read("../src/popout.css");
    expect(css).toMatch(/@layer components \{/);

    expect(css).toMatch(
      /\.popout\.is-anchored \{[^}]*z-index: var\(--z-popout\);/,
    );

    expect(css).toMatch(/\.popout\.is-sheet \{/);
    expect(css).toMatch(/\.popout::backdrop \{[^}]*var\(--veil\)/);

    expect(css).toMatch(
      /html\.popout-open,\s*html\.popout-open body \{\s*overflow: hidden;/,
    );

    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
  });
});
