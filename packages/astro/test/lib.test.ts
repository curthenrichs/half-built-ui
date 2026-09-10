import { describe, it, expect } from "vitest";
import { readingTime } from "../src/lib/reading-time";
import { visiblePosts, forwardLinkVisible, resolvePostHref } from "../src/lib/drafts";
import { slugifyCategory, pagePath, assertPageRoutable, categoryPath, internalHrefKey } from "../src/lib/slug";
import { groupByMonth, countByCategory } from "../src/lib/archive";
import { formatPostDate } from "../src/lib/format-date";
import { paginatePosts, archivePagePath } from "../src/lib/paginate";

describe("readingTime", () => {
  it("floors at 1 minute", () => { expect(readingTime("a few words")).toBe(1); });
  it("ceils by 200 wpm", () => { expect(readingTime(Array(401).fill("w").join(" "))).toBe(3); });
});

describe("slugifyCategory", () => {
  it("matches WP category slugs", () => {
    expect(slugifyCategory("Home Automation Projects")).toBe("home-automation-projects");
    expect(slugifyCategory("MSOE Undergraduate Projects")).toBe("msoe-undergraduate-projects");
  });
});

describe("categoryPath", () => {
  it("defaults to the /category/ base", () => {
    expect(categoryPath("Hobby Robots")).toBe("/category/hobby-robots/");
  });
  it("takes a base parameter for a non-default URL strategy", () => {
    expect(categoryPath("Hobby Robots", "/news")).toBe("/news/hobby-robots/");
  });
});

const mk = (iso: string, cats: string[]): { data: { date: Date; categories: string[] } } =>
  ({ data: { date: new Date(iso), categories: cats } });

describe("internalHrefKey", () => {
  const ORIGINS = ["https://www.half-built-robots.com", "https://half-built-robots.com"];
  it("root-relative hrefs are their own key, slash-terminated", () => {
    expect(internalHrefKey("/about/")).toBe("/about/");
    expect(internalHrefKey("/about")).toBe("/about/");
    expect(internalHrefKey("/")).toBe("/");
  });
  it("fragments and queries are stripped before lookup", () => {
    expect(internalHrefKey("/about/#bio")).toBe("/about/");
    expect(internalHrefKey("/search/?s=henry")).toBe("/search/");
  });
  it("the site's own absolute origins reduce to their path", () => {
    expect(internalHrefKey("https://www.half-built-robots.com/about/", ORIGINS)).toBe("/about/");
    expect(internalHrefKey("https://half-built-robots.com", ORIGINS)).toBe("/");
  });
  it("external hrefs and file-ish paths carry no key", () => {
    expect(internalHrefKey("https://example.com/about/", ORIGINS)).toBeNull();
    expect(internalHrefKey("//example.com/x")).toBeNull();
    expect(internalHrefKey("/feed.xml")).toBeNull();
    expect(internalHrefKey("mailto:x@y.z")).toBeNull();
    expect(internalHrefKey("#top")).toBeNull();
  });
});

describe("archive grouping", () => {
  const posts = [mk("2025-03-10", ["A"]), mk("2025-03-24", ["A", "B"]), mk("2026-02-17", ["B"])];
  it("groups months desc with labels", () => {
    const g = groupByMonth(posts);
    expect(g[0]).toMatchObject({ year: "2026", month: "02", label: "February 2026", count: 1 });
    expect(g[1]).toMatchObject({ year: "2025", month: "03", count: 2 });
  });
  it("counts categories", () => {
    expect(countByCategory(posts)).toEqual([
      { name: "A", slug: "a", count: 2 },
      { name: "B", slug: "b", count: 2 },
    ]);
  });
  it("threads a locale parameter into the month label", () => {
    const g = groupByMonth([mk("2026-01-15", ["A"])], "de-DE");
    expect(g[0].label).toContain("Januar");
  });
});

describe("formatPostDate", () => {
  it("threads a locale parameter (proves it is not welded to en-US)", () => {
    expect(formatPostDate(new Date(Date.UTC(2026, 0, 5)), "de-DE")).toContain("Januar");
  });
});

describe("paginatePosts", () => {
  it("chunks by size", () => {
    expect(paginatePosts([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("empty input yields one empty page", () => {
    expect(paginatePosts([], 10)).toEqual([[]]);
  });
});

describe("archivePagePath", () => {
  it("page 1 is the site root", () => { expect(archivePagePath(1)).toBe("/"); });
  it("deeper pages get /page/N/ with trailing slash", () => {
    expect(archivePagePath(2)).toBe("/page/2/");
    expect(archivePagePath(3)).toBe("/page/3/");
  });
  it("clamps below 1 to the root", () => { expect(archivePagePath(0)).toBe("/"); });
  it("prefixes a base for category archives", () => {
    expect(archivePagePath(1, "/category/robots")).toBe("/category/robots/");
    expect(archivePagePath(2, "/category/robots")).toBe("/category/robots/page/2/");
  });
});

describe("publication ordering (audit A1/A2 root)", () => {
  it("byNewest breaks same-day ties by published timestamp", async () => {
    const { byNewest, publishedAt } = await import("../src/lib/ordering");
    const mkPost = (date: string, published?: string): import("../src/lib/ordering").Publishable =>
      ({ data: { date: new Date(date), published: published ? new Date(published) : undefined } });
    const early = mkPost("2026-02-17", "2026-02-17T02:50:24");
    const late = mkPost("2026-02-17", "2026-02-17T13:37:44");
    const dateOnly = mkPost("2026-02-18");
    expect([early, dateOnly, late].sort(byNewest).map((p) => +publishedAt(p))).toEqual(
      [+publishedAt(dateOnly), +publishedAt(late), +publishedAt(early)]
    );
    expect(+publishedAt(dateOnly)).toBe(+dateOnly.data.date);
  });
});

describe("assertPageRoutable", () => {
  const page = (slug: string, parent?: string) => ({ data: { slug, parent } });
  it("accepts ordinary top-level and resolved-parent pages", () => {
    expect(() => { assertPageRoutable(page("about"), undefined); }).not.toThrow();
    expect(() => { assertPageRoutable(page("privacy-policy", "policies"), page("policies")); }).not.toThrow();
  });
  it("rejects a parent reference that resolves to nothing", () => {
    expect(() => { assertPageRoutable(page("privacy-policy", "policeis"), undefined); }).toThrow(/matches no page slug/);
  });
  it("rejects slugs that shadow real routes", () => {
    for (const slug of ["page", "category", "search", "404", "2025"])
      expect(() => { assertPageRoutable(page(slug), undefined); }).toThrow(/reserved route/);
  });
});

describe("visiblePosts", () => {
  const post = (slug: string, draft?: boolean) => ({ data: { slug, draft } });
  const all = [post("a"), post("b", true), post("c", false)];
  it("drops drafts by default", () => {
    expect(visiblePosts(all, false).map((p) => p.data.slug)).toEqual(["a", "c"]);
  });
  it("keeps drafts when showDrafts is set", () => {
    expect(visiblePosts(all, true)).toEqual(all);
  });
  it("treats a missing draft field as published", () => {
    expect(visiblePosts([post("a")], false)).toEqual([post("a")]);
  });
});

describe("forwardLinkVisible", () => {
  const posts = [
    { data: { slug: "live", draft: false } },
    { data: { slug: "soon", draft: true } },
  ];
  it("shows a passage whose target is published", () => {
    expect(forwardLinkVisible("live", posts, false)).toBe(true);
  });
  it("hides a passage whose target is a draft, unless drafts are shown", () => {
    expect(forwardLinkVisible("soon", posts, false)).toBe(false);
    expect(forwardLinkVisible("soon", posts, true)).toBe(true);
  });
  it("throws on a slug no post has, so a typo cannot pass as a draft", () => {
    expect(() => forwardLinkVisible("typo", posts, false)).toThrow(/no post has slug "typo"/);
  });
});

describe("resolvePostHref", () => {
  const posts = [{ data: { slug: "live", date: new Date("2026-09-01T00:00:00Z") } }];
  it("resolves a slug to the dated permalink", () => {
    expect(resolvePostHref("live", posts)).toBe("/2026/09/01/live/");
  });
  it("throws on an unknown slug", () => {
    expect(() => resolvePostHref("typo", posts)).toThrow(/no post has slug "typo"/);
  });
});

describe("pagePath", () => {
  it("top-level page", () => {
    expect(pagePath({ data: { slug: "about" } })).toBe("/about/");
  });
  it("child page nests under its parent", () => {
    expect(pagePath({ data: { slug: "privacy-policy", parent: "policies" } })).toBe("/policies/privacy-policy/");
  });
});
