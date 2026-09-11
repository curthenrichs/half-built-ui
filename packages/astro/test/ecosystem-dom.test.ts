// @vitest-environment jsdom
/* The ecosystem island: validation, sorting, fetch with retry, the
   last-known-good cache, and the render. Mirrors the jsdom conventions
   in theme-toggle-dom.test.ts, with global fetch stubbed per test. */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  validateDocument,
  sortEntries,
  loadDocument,
  mountEcosystem,
} from "../src/scripts/ecosystem";

const DOC = {
  version: 1,
  updated: "2026-09-06",
  entries: [
    {
      key: "blog",
      label: "Half-Built Robots",
      href: "https://half-built-robots.com/",
      priority: 0,
      family: "half-built",
    },
    {
      key: "beadz",
      label: "The Bead Reserve",
      href: null,
      priority: 1,
      family: "half-built",
    },
    {
      key: "portfolio",
      label: "Portfolio",
      href: "https://curthenrichs.github.io/",
      priority: 1,
      family: "adjacent",
    },
    {
      key: "okospolip",
      label: "Okos Polip",
      href: null,
      priority: 2,
      family: "adjacent",
    },
    {
      key: "ui",
      label: "half-built-ui",
      href: "https://ui.half-built-robots.com/",
      priority: 3,
      family: "half-built",
    },
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

  it("refuses an entry whose href is not an absolute http(s) URL", () => {
    const bad = {
      ...DOC,
      entries: [{ ...DOC.entries[0], href: "javascript:alert(1)" }],
    };

    expect(validateDocument(bad)).toBeNull();
  });
});

describe("sortEntries", () => {
  it("puts the self entry's own family first, each group by priority", () => {
    expect(keys(sortEntries(DOC.entries, "ui", 6))).toEqual([
      "blog",
      "beadz",
      "ui",
      "portfolio",
      "okospolip",
    ]);
  });

  it("sorts differently for a site in the other family", () => {
    expect(keys(sortEntries(DOC.entries, "portfolio", 6))).toEqual([
      "portfolio",
      "okospolip",
      "blog",
      "beadz",
      "ui",
    ]);
  });

  it("breaks a priority tie inside one family on the label", () => {
    const tied = [
      {
        key: "zeta",
        label: "Zeta",
        href: null,
        priority: 1,
        family: "half-built",
      },
      {
        key: "alpha",
        label: "Alpha",
        href: null,
        priority: 1,
        family: "half-built",
      },
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => {
      map.clear();
    },
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => {
      map.delete(k);
    },
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
}

describe("loadDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the document on a first-attempt success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(DOC));
    vi.stubGlobal("fetch", fetchMock);

    const doc = await loadDocument(
      "https://e.test/x.json",
      null,
      1000,
      NO_DELAY,
    );

    expect(doc?.entries).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 500 and succeeds on the second attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse(DOC));

    vi.stubGlobal("fetch", fetchMock);

    const doc = await loadDocument(
      "https://e.test/x.json",
      null,
      1000,
      NO_DELAY,
    );

    expect(doc?.entries).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a network failure up to three attempts, then gives up", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);

    const doc = await loadDocument(
      "https://e.test/x.json",
      null,
      1000,
      NO_DELAY,
    );

    expect(doc).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a 404, because the URL is wrong", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 404));
    vi.stubGlobal("fetch", fetchMock);

    expect(
      await loadDocument("https://e.test/x.json", null, 1000, NO_DELAY),
    ).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry an unparseable body, because the bytes will not change", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{not json", { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    expect(
      await loadDocument("https://e.test/x.json", null, 1000, NO_DELAY),
    ).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a valid response carrying an unknown version", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ...DOC, version: 99 }));

    vi.stubGlobal("fetch", fetchMock);

    expect(
      await loadDocument("https://e.test/x.json", null, 1000, NO_DELAY),
    ).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches a success and serves it when a later load fails outright", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));
    await loadDocument("https://e.test/x.json", storage, 1000, NO_DELAY);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const doc = await loadDocument(
      "https://e.test/x.json",
      storage,
      2000,
      NO_DELAY,
    );

    expect(doc?.entries).toHaveLength(5);
  });

  it("prefers a fresh fetch over a present, valid cache entry", async () => {
    const storage = memoryStorage();
    const staleDoc = { version: 1, entries: [DOC.entries[0]] };

    storage.setItem(
      "half-built-ecosystem",
      JSON.stringify({ fetchedAt: 500, document: staleDoc }),
    );

    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(DOC));
    vi.stubGlobal("fetch", fetchMock);

    const doc = await loadDocument(
      "https://e.test/x.json",
      storage,
      1000,
      NO_DELAY,
    );

    expect(doc?.entries).toHaveLength(5);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores a cached copy older than a day", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));
    await loadDocument("https://e.test/x.json", storage, 1000, NO_DELAY);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const dayLater = 1000 + 24 * 60 * 60 * 1000 + 1;

    expect(
      await loadDocument("https://e.test/x.json", storage, dayLater, NO_DELAY),
    ).toBeNull();
  });

  it("refuses a cached copy carrying a stale schema", async () => {
    const storage = memoryStorage();

    storage.setItem(
      "half-built-ecosystem",
      JSON.stringify({
        fetchedAt: 1000,
        document: { version: 99, entries: DOC.entries },
      }),
    );

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    expect(
      await loadDocument("https://e.test/x.json", storage, 1500, NO_DELAY),
    ).toBeNull();
  });

  it("survives a storage that throws", async () => {
    const hostile = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
      clear: () => {
        throw new Error("blocked");
      },
      key: () => null,
      length: 0,
    } as unknown as Storage;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));

    const doc = await loadDocument(
      "https://e.test/x.json",
      hostile,
      1000,
      NO_DELAY,
    );

    expect(doc?.entries).toHaveLength(5);
  });
});

const BASELINE = `
  <ul data-ecosystem>
    <li><span class="footer-sitemap-self">half-built-ui</span></li>
    <li><a href="https://half-built-robots.com/">Half-Built Robots</a></li>
  </ul>`;

function mountFixture(): HTMLElement {
  document.body.innerHTML = BASELINE;
  const list = document.querySelector<HTMLElement>("[data-ecosystem]");
  if (!list) throw new Error("no fixture list");
  return list;
}

describe("mountEcosystem", () => {
  beforeEach(() => {
    /* mountEcosystem reads the real jsdom localStorage (there is no
       storage parameter on its public signature), and jsdom's window
       is shared across every test in this file. Without this, a test
       could start behind a document cached by whatever ran before it
       and read it back through loadDocument's fallback path, so this
       guarantees a clean starting state regardless of test order. */
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replaces the baseline with the fetched list in sorted order", async () => {
    const list = mountFixture();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));

    await mountEcosystem(document, {
      endpoint: "https://e.test/x.json",
      selfKey: "ui",
      retryDelaysMs: NO_DELAY,
    });

    expect(
      [...list.querySelectorAll("li")].map((li) => li.textContent),
    ).toEqual([
      "Half-Built Robots",
      "The Bead Reserve",
      "half-built-ui",
      "Portfolio",
      "Okos Polip",
    ]);
  });

  it("renders the three states the component renders", async () => {
    const list = mountFixture();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));

    await mountEcosystem(document, {
      endpoint: "https://e.test/x.json",
      selfKey: "ui",
      retryDelaysMs: NO_DELAY,
    });

    expect(list.querySelector(".footer-sitemap-self")?.textContent).toBe(
      "half-built-ui",
    );

    expect(
      list.querySelector('a[href="https://half-built-robots.com/"]'),
    ).not.toBeNull();

    /* Two undeployed properties, both visible and unlinked. */
    expect(list.querySelectorAll(".footer-sitemap-pending")).toHaveLength(2);
  });

  /* The bug these two cover shipped in 0.3.0 and neither suite saw it.
     The list swapped correctly and carried the right classes, so every
     assertion passed while the rendered footer lost its bold, its
     dimming, and its link styling. Astro's scoped rules only match
     elements carrying the component's data-astro-cid attribute, and
     nothing built with createElement carries it. Assert the attribute
     here; the browser suite asserts the computed styles it buys. */
  it("stamps the component's scope attribute onto everything it builds", async () => {
    document.body.innerHTML = `
      <ul data-ecosystem data-astro-cid-abc123>
        <li data-astro-cid-abc123><span class="footer-sitemap-self" data-astro-cid-abc123>half-built-ui</span></li>
      </ul>`;

    const list = document.querySelector<HTMLElement>("[data-ecosystem]");
    if (!list) throw new Error("no fixture list");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));

    await mountEcosystem(document, {
      endpoint: "https://e.test/x.json",
      selfKey: "ui",
      retryDelaysMs: NO_DELAY,
    });

    const built = [...list.querySelectorAll("li, li > *")];
    expect(built.length).toBe(10);

    expect(built.every((el) => el.hasAttribute("data-astro-cid-abc123"))).toBe(
      true,
    );
  });

  it("builds an unscoped list when the consumer's footer is unscoped", async () => {
    const list = mountFixture();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));

    await mountEcosystem(document, {
      endpoint: "https://e.test/x.json",
      selfKey: "ui",
      retryDelaysMs: NO_DELAY,
    });

    const attrs = [...list.querySelectorAll("li, li > *")].flatMap((el) =>
      [...el.attributes].map((a) => a.name),
    );

    expect(attrs.filter((n) => n.startsWith("data-astro-cid-"))).toEqual([]);
  });

  it("marks the self entry for a screen reader, which cannot see the bold", async () => {
    const list = mountFixture();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));

    await mountEcosystem(document, {
      endpoint: "https://e.test/x.json",
      selfKey: "ui",
      retryDelaysMs: NO_DELAY,
    });

    expect(
      list.querySelector(".footer-sitemap-self")?.getAttribute("aria-current"),
    ).toBe("page");

    expect(list.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
  });

  it("honours the limit", async () => {
    const list = mountFixture();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));

    await mountEcosystem(document, {
      endpoint: "https://e.test/x.json",
      selfKey: "ui",
      limit: 2,
      retryDelaysMs: NO_DELAY,
    });

    expect(list.querySelectorAll("li")).toHaveLength(2);
  });

  it("leaves the baseline alone when the fetch fails outright", async () => {
    const list = mountFixture();
    const before = list.innerHTML;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await mountEcosystem(document, {
      endpoint: "https://e.test/x.json",
      selfKey: "ui",
      retryDelaysMs: NO_DELAY,
    });

    expect(list.innerHTML).toBe(before);
  });

  it("leaves the baseline alone when the document omits this site", async () => {
    const list = mountFixture();
    const before = list.innerHTML;

    const without = {
      ...DOC,
      entries: DOC.entries.filter((e) => e.key !== "ui"),
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(without)));

    await mountEcosystem(document, {
      endpoint: "https://e.test/x.json",
      selfKey: "ui",
      retryDelaysMs: NO_DELAY,
    });

    expect(list.innerHTML).toBe(before);
  });

  it("does nothing at all when the page has no ecosystem list", async () => {
    document.body.innerHTML = "<p>no footer here</p>";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await mountEcosystem(document, {
      endpoint: "https://e.test/x.json",
      selfKey: "ui",
      retryDelaysMs: NO_DELAY,
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
