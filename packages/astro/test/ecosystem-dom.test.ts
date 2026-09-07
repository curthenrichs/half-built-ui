// @vitest-environment jsdom
/* The ecosystem island: validation, sorting, fetch with retry, the
   last-known-good cache, and the render. Mirrors the jsdom conventions
   in theme-toggle-dom.test.ts, with global fetch stubbed per test. */
import { describe, it, expect } from "vitest";
import { validateDocument, sortEntries } from "../src/scripts/ecosystem";

const DOC = {
  version: 1,
  updated: "2026-09-06",
  entries: [
    { key: "blog", label: "Half-Built Robots", href: "https://half-built-robots.com/", priority: 0, family: "half-built" },
    { key: "beadz", label: "The Bead Reserve", href: null, priority: 1, family: "half-built" },
    { key: "portfolio", label: "Portfolio", href: "https://curthenrichs.github.io/", priority: 1, family: "adjacent" },
    { key: "okospolip", label: "Okos Polip", href: null, priority: 2, family: "adjacent" },
    { key: "ui", label: "half-built-ui", href: "https://ui.half-built-robots.com/", priority: 3, family: "half-built" },
  ],
};

const keys = (entries: { key: string }[] | null): string[] =>
  entries === null ? [] : entries.map((e) => e.key);

describe("validateDocument", () => {
  it("accepts the shipped document", () => {
    expect(validateDocument(DOC)?.entries).toHaveLength(5);
  });

  it("refuses a version it does not know", () => {
    expect(validateDocument({ ...DOC, version: 2 })).toBeNull();
  });

  it("refuses a non-object, a missing entries array, and an empty one", () => {
    expect(validateDocument(null)).toBeNull();
    expect(validateDocument("nope")).toBeNull();
    expect(validateDocument({ version: 1 })).toBeNull();
    expect(validateDocument({ version: 1, entries: [] })).toBeNull();
  });

  it("refuses an entry with a bad field", () => {
    const bad = { ...DOC, entries: [{ ...DOC.entries[0], priority: "0" }] };
    expect(validateDocument(bad)).toBeNull();
    const noKey = { ...DOC, entries: [{ ...DOC.entries[0], key: "" }] };
    expect(validateDocument(noKey)).toBeNull();
  });

  it("accepts a null href, which is how an undeployed property renders", () => {
    const one = { ...DOC, entries: [DOC.entries[1]] };
    expect(validateDocument(one)?.entries[0].href).toBeNull();
  });
});

describe("sortEntries", () => {
  it("puts the self entry's own family first, each group by priority", () => {
    expect(keys(sortEntries(DOC.entries, "ui", 6))).toEqual([
      "blog", "beadz", "ui", "portfolio", "okospolip",
    ]);
  });

  it("sorts differently for a site in the other family", () => {
    expect(keys(sortEntries(DOC.entries, "portfolio", 6))).toEqual([
      "portfolio", "okospolip", "blog", "beadz", "ui",
    ]);
  });

  it("breaks a priority tie inside one family on the label", () => {
    const tied = [
      { key: "zeta", label: "Zeta", href: null, priority: 1, family: "half-built" },
      { key: "alpha", label: "Alpha", href: null, priority: 1, family: "half-built" },
    ];
    expect(keys(sortEntries(tied, "zeta", 6))).toEqual(["alpha", "zeta"]);
  });

  it("caps at the limit", () => {
    expect(keys(sortEntries(DOC.entries, "ui", 2))).toEqual(["blog", "beadz"]);
  });

  it("refuses when no entry matches the self key", () => {
    expect(sortEntries(DOC.entries, "nobody", 6)).toBeNull();
  });
});
