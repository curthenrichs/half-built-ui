/* Pins for the verbatim move (step 11.3 task 2): concrete facts the
   brief calls out so a later edit to these files trips a test instead
   of silently drifting. Not a re-test of the blog's own suite, which
   stays behind in half-built-robots-blog. */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

  it("toc.css keeps a vh panel height for engines without dvh", () => {
    /* A var() whose fallback holds an unknown unit is invalid at
       computed-value time, which drops max-height to none instead of
       falling back to an earlier declaration (final review
       2026-11-21). So the dvh line sits behind @supports. */
    const css = read("../src/toc.css");

    expect(css).toMatch(
      /max-height: var\(--toc-panel-max-height, calc\(100vh - 6rem\)\);/,
    );

    expect(css).toMatch(
      /@supports \(height: 100dvh\) \{[^}]*\{[^}]*calc\(100dvh - 6rem\)/,
    );

    expect(
      css.replace(/@supports \(height: 100dvh\) \{[^}]*\{[^}]*\}/g, ""),
    ).not.toMatch(/dvh\)/);
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

  it("the light focus ring is the amber ink, which clears 3:1 on white", () => {
    expect(read("../src/tokens/theme-light.css")).toMatch(
      /--focus-ring: var\(--brand-1-700\);/,
    );
  });

  it("the light Y track is the teal ink, which clears 3:1 on white", () => {
    expect(read("../src/tokens/theme-light.css")).toMatch(
      /--track-y: var\(--brand-2-700\);/,
    );
  });

  it("the code comment ink clears 4.5:1 on the code ground", () => {
    expect(read("../src/tokens/primitives.css")).toMatch(
      /--umber-500: #8e7e67;/,
    );
  });

  it("the z ladder keeps its documented order, local rungs below every page rung", () => {
    const prims = read("../src/tokens/primitives.css");

    const z = (name: string): number => {
      const m = new RegExp(`--${name}: (\\d+);`).exec(prims);
      if (!m) throw new Error(`--${name} missing`);
      return Number(m[1]);
    };

    /* The order the css README's Stacking table documents. The local
       rungs come first: they may meet a page layer in the root
       context, and must always lose to it. */
    const order = [
      "z-raised",
      "z-raised-top",
      "z-skip-link",
      "z-scroll-top",
      "z-panel",
      "z-popout",
      "z-tooltip",
      "z-search-flyout",
    ];

    const values = order.map(z);

    for (let i = 1; i < values.length; i++) {
      expect(values[i], `--${order[i]} over --${order[i - 1]}`).toBeGreaterThan(
        values[i - 1],
      );
    }
  });

  it("retired tokens are gone from every css file", () => {
    const retired = [
      "--input-border",
      "--font-size-xxxl",
      "--ink-950",
      "--ink-850",
      "--ink-700",
      "--parchment-dim",
      "--stroke-1",
    ];

    const all = [
      "../src/tokens/primitives.css",
      "../src/tokens/theme-light.css",
      "../src/tokens/theme-dark.css",
    ]
      .map(read)
      .join("\n");

    for (const t of retired) expect(all, t).not.toContain(`${t}:`);
  });

  it("reduced motion turns smooth scrolling off", () => {
    const reset = read("../src/base/reset.css");

    const block =
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n {2}\}/.exec(
        reset,
      );

    expect(block?.[0]).toMatch(/scroll-behavior: auto/);
  });

  it("no raw z-index in the package sources", () => {
    const files: string[] = [];

    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);

        if (entry.isDirectory()) walk(full);
        else if (/\.(css|astro)$/.test(entry.name)) files.push(full);
      }
    };

    for (const root of ["../src", "../../astro/src"]) {
      walk(fileURLToPath(new URL(root, import.meta.url)));
    }

    expect(files.length).toBeGreaterThan(20);

    const raw: string[] = [];

    for (const file of files) {
      const text = readFileSync(file, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");

      for (const m of text.matchAll(/z-index:\s*([^;}]+)[;}]/gi)) {
        const value = m[1].trim();

        if (value !== "auto" && !/^var\(--z-[a-z0-9-]+\)$/.test(value)) {
          raw.push(`${file}: ${value}`);
        }
      }
    }

    expect(raw).toEqual([]);
  });

  it("primitives define the local stacking tokens", () => {
    const prims = read("../src/tokens/primitives.css");

    expect(prims).toMatch(/--z-raised: 1;/);
    expect(prims).toMatch(/--z-raised-top: 2;/);
  });
});
