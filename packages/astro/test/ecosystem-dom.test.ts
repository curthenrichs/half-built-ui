// @vitest-environment jsdom
/* The ecosystem island: validation, sorting, fetch with retry, the
   last-known-good cache, and the render. Mirrors the jsdom conventions
   in theme-toggle-dom.test.ts, with global fetch stubbed per test. */
import { describe, it, expect, afterEach, vi } from "vitest";
import { validateDocument, sortEntries, loadDocument } from "../src/scripts/ecosystem";

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

const NO_DELAY = [0, 0];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => { map.clear(); },
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

describe("loadDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the document on a first-attempt success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(DOC));
    vi.stubGlobal("fetch", fetchMock);
    const doc = await loadDocument("https://e.test/x.json", null, 1000, NO_DELAY);
    expect(doc?.entries).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 500 and succeeds on the second attempt", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse(DOC));
    vi.stubGlobal("fetch", fetchMock);
    const doc = await loadDocument("https://e.test/x.json", null, 1000, NO_DELAY);
    expect(doc?.entries).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a network failure up to three attempts, then gives up", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const doc = await loadDocument("https://e.test/x.json", null, 1000, NO_DELAY);
    expect(doc).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 404, because the URL is wrong", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 404));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadDocument("https://e.test/x.json", null, 1000, NO_DELAY)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry an unparseable body, because the bytes will not change", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{not json", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadDocument("https://e.test/x.json", null, 1000, NO_DELAY)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a valid response carrying an unknown version", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ...DOC, version: 99 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await loadDocument("https://e.test/x.json", null, 1000, NO_DELAY)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches a success and serves it when a later load fails outright", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));
    await loadDocument("https://e.test/x.json", storage, 1000, NO_DELAY);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const doc = await loadDocument("https://e.test/x.json", storage, 2000, NO_DELAY);
    expect(doc?.entries).toHaveLength(5);
  });

  it("ignores a cached copy older than a day", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));
    await loadDocument("https://e.test/x.json", storage, 1000, NO_DELAY);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const dayLater = 1000 + 24 * 60 * 60 * 1000 + 1;
    expect(await loadDocument("https://e.test/x.json", storage, dayLater, NO_DELAY)).toBeNull();
  });

  it("refuses a cached copy carrying a stale schema", async () => {
    const storage = memoryStorage();
    storage.setItem("half-built-ecosystem", JSON.stringify({ fetchedAt: 1000, document: { version: 99, entries: DOC.entries } }));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await loadDocument("https://e.test/x.json", storage, 1500, NO_DELAY)).toBeNull();
  });

  it("survives a storage that throws", async () => {
    const hostile = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
      clear: () => { throw new Error("blocked"); },
      key: () => null,
      length: 0,
    } as unknown as Storage;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));
    const doc = await loadDocument("https://e.test/x.json", hostile, 1000, NO_DELAY);
    expect(doc?.entries).toHaveLength(5);
  });
});
