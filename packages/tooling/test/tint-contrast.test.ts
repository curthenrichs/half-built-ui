import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { contrastRatio } from "../src/palette/contrast.ts";
import { TINT_MAX, tintGround } from "../src/palette/grounds.ts";

/* The color-mix tints themselves, at rest and on hover: each mixes an
   accent (or the ink) into the surface, and the text on it must hold
   AA in both themes. The share is read from the stylesheet, so
   retuning a tint re-runs the check; every share must also stay at or
   under TINT_MAX, the strongest tint derivePalette walks its text
   stops against, so a consumer's derived palette holds on these
   grounds too. fallback-contrast.test.ts covers the plain grounds
   below the floor. */
const ROOT = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf-8");

const SUPPORTS = "@supports (color: color-mix(in srgb, red, red)) {";

/* Each accent pair a box can wear: the mixed token and its text. */
const ACCENT_1: [string, string] = ["--accent-1", "--accent-1-ink"];
const ACCENT_2: [string, string] = ["--accent-2", "--accent-2-ink"];

/* .press-box-accent mixes --press-accent, which its knob classes
   point at either accent; every other row names its token outright. */
const ROWS: { file: string; selector: string; pairs: [string, string][] }[] = [
  {
    file: "packages/css/src/patterns.css",
    selector: ".press-box-accent {",
    pairs: [ACCENT_1, ACCENT_2],
  },
  {
    file: "packages/css/src/patterns.css",
    selector: ".press-box-accent:hover {",
    pairs: [ACCENT_1, ACCENT_2],
  },
  {
    file: "packages/css/src/patterns.css",
    selector: ".press-box-shaded {",
    pairs: [["--ink", "--ink"]],
  },
  {
    file: "packages/css/src/toc.css",
    selector: ".toc-inline-summary {",
    pairs: [ACCENT_1],
  },
  {
    file: "packages/css/src/toc.css",
    selector: ".toc-inline-summary:hover {",
    pairs: [ACCENT_1],
  },
  {
    file: "packages/astro/src/components/SiteHeader.astro",
    selector: ".site-description {",
    pairs: [ACCENT_1],
  },
  {
    file: "site/src/styles/site.css",
    selector: ".site-knob > summary {",
    pairs: [ACCENT_1],
  },
  {
    file: "site/src/styles/site.css",
    selector: ".site-knob > summary:hover {",
    pairs: [ACCENT_1],
  },
  {
    file: "site/src/styles/site.css",
    selector: '.site-toolbar-presets button[aria-pressed="true"] {',
    pairs: [ACCENT_1],
  },
];

const MIX =
  /color-mix\(\s*in srgb,\s*var\((--[a-z0-9-]+)\)\s+(\d+)%,\s*var\(--surface\)\s*\)/g;

/* The bodies of a file's color-mix @supports blocks, braces matched. */
const supportsBodies = (css: string): string[] => {
  const bodies: string[] = [];

  for (let at = css.indexOf(SUPPORTS); at >= 0;) {
    const open = at + SUPPORTS.length;
    let depth = 1;
    let i = open;

    for (; i < css.length && depth > 0; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
    }

    bodies.push(css.slice(open, i - 1));
    at = css.indexOf(SUPPORTS, i);
  }

  return bodies;
};

/* The rule's tint: the color-mix in its block inside a color-mix
   @supports, as the mixed token and its share. */
const tintOf = (
  row: (typeof ROWS)[number],
): { token: string; share: number } => {
  for (const body of supportsBodies(read(row.file))) {
    const start = body.indexOf(row.selector);
    if (start < 0) continue;
    const block = body.slice(start, body.indexOf("}", start));
    const m = new RegExp(MIX.source).exec(block);
    if (!m) throw new Error(`no color-mix tint in ${row.selector}`);
    return { token: m[1], share: Number(m[2]) / 100 };
  }

  throw new Error(`${row.selector} has no @supports tint in ${row.file}`);
};

const declarations = (css: string): Map<string, string> =>
  new Map(
    [...css.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );

const primitives = declarations(read("packages/css/src/tokens/primitives.css"));

const THEMES = {
  light: declarations(read("packages/css/src/tokens/theme-light.css")),
  dark: declarations(read("packages/css/src/tokens/theme-dark.css")),
};

const resolve = (theme: Map<string, string>, token: string): string => {
  let value = theme.get(token) ?? primitives.get(token);

  for (let hops = 0; value?.startsWith("var(") && hops < 5; hops++) {
    const next = /^var\((--[a-z0-9-]+)\)$/.exec(value)?.[1] ?? "";

    value = theme.get(next) ?? primitives.get(next);
  }

  if (!value?.startsWith("#")) throw new Error(`cannot resolve ${token}`);

  return value;
};

describe("color-mix tint contrast", () => {
  for (const [theme, tokens] of Object.entries(THEMES)) {
    it.each(ROWS)(`${theme}: $selector holds AA on its tint`, (row) => {
      const { token, share } = tintOf(row);
      const surface = resolve(tokens, "--surface");

      for (const [mixed, text] of row.pairs) {
        if (token !== "--press-accent") expect(token).toBe(mixed);
        const ground = tintGround(resolve(tokens, mixed), surface, share);

        expect(
          contrastRatio(resolve(tokens, text), ground),
          `${mixed} at ${String(share * 100)}%`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("every accent tint stays within TINT_MAX", () => {
    for (const row of ROWS) {
      const { token, share } = tintOf(row);

      if (token !== "--ink") {
        expect(share, row.selector).toBeLessThanOrEqual(TINT_MAX);
      }
    }
  });

  /* Every color-mix in the packages and the site (bar the @supports
     queries themselves) must be an accent-into-surface tint this test
     can read, and each must have a row: a new tint anywhere, or one
     written another way, fails here rather than going unchecked. */
  it("every color-mix in the packages and the site is a tint with a row", () => {
    const dirs = [
      "packages/css/src",
      "packages/astro/src",
      "packages/tooling/src",
      "site/src",
    ];

    const files = dirs.flatMap((d) =>
      readdirSync(new URL(d, ROOT), { recursive: true })
        .map(String)
        .filter((f) => /\.(?:css|astro)$/.test(f))
        .map((f) => `${d}/${f.replaceAll("\\", "/")}`),
    );

    let tints = 0;

    for (const file of files) {
      const css = read(file);
      const all = css.split("color-mix(").length - 1;
      const queries = css.split(SUPPORTS).length - 1;
      const readable = [...css.matchAll(MIX)].length;

      expect(readable, `${file}: a color-mix this test cannot read`).toBe(
        all - queries,
      );

      expect(readable, `${file}: tints without rows`).toBe(
        ROWS.filter((r) => r.file === file).length,
      );

      tints += readable;
    }

    expect(tints).toBe(ROWS.length);
  });
});
