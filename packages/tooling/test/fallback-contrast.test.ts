import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { contrastRatio } from "../src/palette/contrast.ts";

/* A browser below the floor's color-mix support paints the plain
   fallback declared before each color-mix, so the fallback ground must
   hold AA for the text on it in both themes, the same bar the mixed
   ground meets. Each row names the rule and the text token it renders
   (read from the rule or the component it belongs to); the fallback is
   read from the stylesheet, so changing it re-runs the check. */
const ROOT = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf-8");

const ROWS: { file: string; selector: string; text: string }[] = [
  {
    file: "packages/css/src/patterns.css",
    selector: ".press-box-accent {",
    text: "--accent-2-ink",
  },
  {
    file: "packages/css/src/patterns.css",
    selector: ".press-box-accent:hover {",
    text: "--accent-2-ink",
  },
  {
    file: "packages/css/src/patterns.css",
    selector: ".press-box-shaded {",
    text: "--ink",
  },
  {
    file: "packages/css/src/toc.css",
    selector: ".toc-inline-summary {",
    text: "--accent-1-ink",
  },
  {
    file: "packages/css/src/toc.css",
    selector: ".toc-inline-summary:hover {",
    text: "--accent-1-ink",
  },
  {
    file: "packages/astro/src/components/SiteHeader.astro",
    selector: ".site-description {",
    text: "--accent-1-ink",
  },
  {
    file: "site/src/styles/site.css",
    selector: ".site-knob > summary {",
    text: "--accent-1-ink",
  },
  {
    file: "site/src/styles/site.css",
    selector: ".site-knob > summary:hover {",
    text: "--accent-1-ink",
  },
  {
    file: "site/src/styles/site.css",
    selector: '.site-toolbar-presets button[aria-pressed="true"] {',
    text: "--accent-1-ink",
  },
];

/* --name: value; pairs from a token file. */
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

/* Follows var() through the theme, then the primitives, to a hex. */
const resolve = (theme: Map<string, string>, token: string): string => {
  let value = theme.get(token) ?? primitives.get(token);

  for (let hops = 0; value?.startsWith("var(") && hops < 5; hops++) {
    const next = /^var\((--[a-z0-9-]+)\)$/.exec(value)?.[1] ?? "";

    value = theme.get(next) ?? primitives.get(next);
  }

  if (!value?.startsWith("#")) throw new Error(`cannot resolve ${token}`);

  return value;
};

/* The token in the declaration directly before the rule's color-mix. */
const fallbackToken = (file: string, selector: string): string => {
  const css = read(file);
  const start = css.indexOf(selector);

  if (start < 0) throw new Error(`${selector} not found in ${file}`);

  const block = css.slice(start, css.indexOf("}", start));

  const m =
    /background(?:-color)?:\s*var\((--[a-z0-9-]+)\);\s*background(?:-color)?:\s*color-mix\(/.exec(
      block,
    );

  if (!m) throw new Error(`no fallback before color-mix in ${selector}`);

  return m[1];
};

describe("color-mix fallback contrast", () => {
  for (const [theme, tokens] of Object.entries(THEMES)) {
    it.each(ROWS)(`${theme}: $selector holds AA on its fallback`, (row) => {
      const ground = resolve(tokens, fallbackToken(row.file, row.selector));
      const ink = resolve(tokens, row.text);

      expect(contrastRatio(ink, ground)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
