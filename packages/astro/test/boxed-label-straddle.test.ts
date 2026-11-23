import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/* The labels that straddle their box's top rule share one pattern,
   .boxed-label-straddle in patterns.css, so a change to the stroke or
   the offset lands in all of them. Each component's label carries the
   class and none restates the placement; the browser suite checks the
   rendered label sits centered on the rule. */
const ROOT = new URL("../../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), "utf-8");

const LABELS: { component: string; css: string; label: string }[] = [
  {
    component: "packages/astro/src/components/content/EditorNote.astro",
    css: "packages/astro/src/components/content/EditorNote.astro",
    label: "editor-note-label",
  },
  {
    component: "packages/astro/src/components/content/Callout.astro",
    css: "packages/astro/src/components/content/Callout.astro",
    label: "callout-label",
  },
  {
    component: "packages/astro/src/components/AuthorBox.astro",
    css: "packages/astro/src/components/AuthorBox.astro",
    label: "author-box-label",
  },
  {
    component: "packages/astro/src/components/Toc.astro",
    css: "packages/css/src/toc.css",
    label: "toc-label",
  },
];

/* What the pattern owns; a component restating any of it has forked. */
const PLACEMENT =
  /\b(?:position|top|left|transform|padding|letter-spacing|text-transform|line-height)\s*:/;

describe("boxed-label straddle pattern", () => {
  it.each(LABELS)(
    "$label carries .boxed-label-straddle",
    ({ component, label }) => {
      const tag = new RegExp(`class="${label} ([^"]*)"`).exec(read(component));

      expect(tag?.[1].split(" ")).toEqual(
        expect.arrayContaining(["boxed-label", "boxed-label-straddle"]),
      );
    },
  );

  it.each(LABELS)("$label restates none of the placement", ({ css, label }) => {
    const source = read(css);
    const start = source.indexOf(`.${label} {`);

    const rule =
      start < 0 ? "" : source.slice(start, source.indexOf("}", start));

    expect(PLACEMENT.test(rule), rule).toBe(false);
  });

  it("patterns.css defines the pattern and its compact size", () => {
    const css = read("packages/css/src/patterns.css");

    expect(css).toContain(".boxed-label-straddle {");
    expect(css).toContain(".boxed-label-straddle-compact {");
  });
});
