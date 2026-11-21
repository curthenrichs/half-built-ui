import { describe, it, expect } from "vitest";
import { tocFromHeadings, type TocHeading } from "../src/lib/toc";

const h = (depth: number, slug: string): TocHeading => ({
  depth,
  slug,
  text: slug.toUpperCase(),
});

describe("tocFromHeadings", () => {
  const input = [h(2, "a"), h(3, "a1"), h(3, "a2"), h(2, "b")];

  it("nests each h3 under the h2 before it", () => {
    expect(tocFromHeadings(input)).toEqual([
      {
        id: "a",
        text: "A",
        children: [
          { id: "a1", text: "A1", children: [] },
          { id: "a2", text: "A2", children: [] },
        ],
      },
      { id: "b", text: "B", children: [] },
    ]);
  });

  it("depth 2 keeps h2s only", () => {
    expect(tocFromHeadings(input, { depth: 2 })).toEqual([
      { id: "a", text: "A", children: [] },
      { id: "b", text: "B", children: [] },
    ]);
  });

  it("drops h1, h4 and deeper", () => {
    const out = tocFromHeadings([
      h(1, "title"),
      h(2, "a"),
      h(4, "deep"),
      h(3, "a1"),
      h(5, "deeper"),
    ]);

    expect(out).toEqual([
      {
        id: "a",
        text: "A",
        children: [{ id: "a1", text: "A1", children: [] }],
      },
    ]);
  });

  it("drops an h3 that comes before the first h2", () => {
    expect(tocFromHeadings([h(3, "x"), h(2, "a")])).toEqual([
      { id: "a", text: "A", children: [] },
    ]);
  });

  it("empty in, empty out", () => {
    expect(tocFromHeadings([])).toEqual([]);
  });
});
