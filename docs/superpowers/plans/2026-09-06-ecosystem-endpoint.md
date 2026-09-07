# Ecosystem Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One hosted JSON document lists the family's web properties, and a footer island fetches it at runtime, so adding a property is one commit to one repo instead of a rebuild of every site.

**Architecture:** A new data-only repo holds `ecosystem.json` and a `_headers` file, deployed by its own Cloudflare Pages project. `@half-built/astro` gains a `data-ecosystem` hook on the Footer's ecosystem list and an island that fetches, validates, sorts and re-renders that list. Every failure path leaves the server-rendered baseline standing.

**Tech Stack:** TypeScript, Astro 5, vitest with jsdom, puppeteer-core for browser tests, plain JSON with no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-06-ecosystem-endpoint-design.md`

## Global Constraints

- No em dashes anywhere, including code comments, docs and READMEs.
- `npx eslint .` must stay clean. The preset forbids non-null assertions and `String.match` where `RegExp.exec` works.
- Nothing in `packages/` reads a consumer's configuration. A component needing site data takes it as typed props. The island takes its endpoint as a parameter and hardcodes no URL.
- Do not bump any package version. Versions move at release time, not in feature work. The island ships in whatever release comes next.
- Henry never enters this repo in any form.
- The demo site uses neutral sample data and generated placeholder SVGs.
- Schema version is `1`. Entry keys never change once published; a rename is a new key.
- The ui site's prose is impersonal and active. No first person, no anecdote.
- Run all gates from the repo root: `npm test`, `npx eslint .`, `npx tsc -p site --noEmit`, `npm run build:site`, and `BROWSER_TESTS=1 npm run test:browser`.

## Owner actions this plan cannot perform

These are recorded for the handoff and are deliberately absent from every task. Do not attempt them.

- Creating the `half-built-ecosystem-data` GitHub remote and pushing to it.
- Creating its Cloudflare Pages project and the `ecosystem` CNAME.
- Flipping `ECOSYSTEM_ENDPOINT` from `null` to the live URL.
- Publishing the package release and bumping the blog's pin.
- Wiring the blog, which consumes the package from the registry and therefore cannot see this work until it publishes.

## File Structure

**New repo, created locally at `../half-built-ecosystem-data/`:**

- `ecosystem.json` - the document itself, the single source of truth.
- `_headers` - Cloudflare Pages CORS and cache directives for that one path.
- `validate.mjs` - a dependency-free shape check a human can run before committing.
- `README.md` - the schema, the edit loop, and the rule that keys are permanent.
- `.gitignore` - minimal.

**Package, `packages/astro/`:**

- `src/scripts/ecosystem.ts` - the island. Owns validation, sorting, fetch with retry, the last-known-good cache, and the render. One file because these parts are meaningless apart and share the schema constants.
- `src/components/Footer.astro` - gains one attribute. Nothing else changes.
- `test/ecosystem-dom.test.ts` - jsdom coverage of every branch above.
- `README.md` - a section documenting the island for consumers.

**Site, `site/`:**

- `src/lib/ecosystem-config.ts` - the self key and the endpoint, split out the way `theme-key.ts` and `palette-key.ts` are, because the body-end script reads them and importing all of `data/site.ts` client-side would drag the nav and social markup into the bundle.
- `src/data/site.ts` - the corrected baseline, re-exporting the self key from that module so there is one definition.
- `src/layouts/Base.astro` - the guarded mount call.
- `test/browser.test.ts` - one assertion that the hook and baseline shipped.

---

### Task 1: The data repo

**Files:**
- Create: `../half-built-ecosystem-data/ecosystem.json`
- Create: `../half-built-ecosystem-data/_headers`
- Create: `../half-built-ecosystem-data/validate.mjs`
- Create: `../half-built-ecosystem-data/README.md`
- Create: `../half-built-ecosystem-data/.gitignore`
- Modify: `../CLAUDE.md` (the workspace table, add a row)

**Interfaces:**
- Consumes: nothing.
- Produces: the document shape every later task validates against. Entry fields are `key: string`, `label: string`, `href: string | null`, `priority: number`, `family: string`. The wrapper is `{ version: 1, updated: string, entries: Entry[] }`.

Note the path. This repo is a sibling of `half-built-ui` inside the workspace directory, not a subdirectory of it. The workspace itself is deliberately not a git repository, so `git init` here creates an independent repo exactly like its siblings.

- [ ] **Step 1: Create the document**

Create `../half-built-ecosystem-data/ecosystem.json`:

```json
{
  "version": 1,
  "updated": "2026-09-06",
  "entries": [
    { "key": "blog", "label": "Half-Built Robots", "href": "https://half-built-robots.com/", "priority": 0, "family": "half-built" },
    { "key": "beadz", "label": "The Bead Reserve", "href": null, "priority": 1, "family": "half-built" },
    { "key": "portfolio", "label": "Portfolio", "href": "https://curthenrichs.github.io/", "priority": 1, "family": "adjacent" },
    { "key": "okospolip", "label": "Okos Polip", "href": null, "priority": 2, "family": "adjacent" },
    { "key": "ui", "label": "half-built-ui", "href": "https://ui.half-built-robots.com/", "priority": 3, "family": "half-built" }
  ]
}
```

Two hrefs are null on purpose. BEADZ has no deployment yet, and okospolip serves a placeholder until its domain transfer completes. Both render visible and unlinked.

- [ ] **Step 2: Create the headers file**

Create `../half-built-ecosystem-data/_headers`:

```
/ecosystem.json
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=300, stale-while-revalidate=86400
```

The allow-origin header is required rather than optional, because every consumer fetches this cross-origin. The cache pair puts an edit live within minutes while keeping the last good copy served for a day if the origin goes quiet.

- [ ] **Step 3: Write the validator**

Create `../half-built-ecosystem-data/validate.mjs`:

```js
/* Shape check for ecosystem.json, dependency free, run with
   `node validate.mjs`. This duplicates the rules in the island's
   validateDocument (half-built-ui packages/astro/src/scripts/
   ecosystem.ts) on purpose: the two live in different repos with no
   dependency between them, and the island refusing bad data protects
   readers while this protects the person editing the file. Keep the
   two in step by hand when the schema changes. */
import { readFileSync } from "node:fs";

const FAMILIES = new Set(["half-built", "adjacent"]);
const problems = [];

let doc;
try {
  doc = JSON.parse(readFileSync(new URL("./ecosystem.json", import.meta.url), "utf8"));
} catch (err) {
  console.error("ecosystem.json does not parse:", err.message);
  process.exit(1);
}

if (doc.version !== 1) problems.push(`version must be 1, found ${JSON.stringify(doc.version)}`);
if (typeof doc.updated !== "string") problems.push("updated must be a string");
if (!Array.isArray(doc.entries) || doc.entries.length === 0) {
  problems.push("entries must be a non-empty array");
} else {
  const seen = new Set();
  doc.entries.forEach((entry, i) => {
    const at = `entries[${i}]`;
    if (typeof entry.key !== "string" || entry.key === "") problems.push(`${at}.key must be a non-empty string`);
    else if (seen.has(entry.key)) problems.push(`${at}.key duplicates ${entry.key}`);
    else seen.add(entry.key);
    if (typeof entry.label !== "string" || entry.label === "") problems.push(`${at}.label must be a non-empty string`);
    if (entry.href !== null && typeof entry.href !== "string") problems.push(`${at}.href must be a string or null`);
    if (!Number.isFinite(entry.priority)) problems.push(`${at}.priority must be a number`);
    if (!FAMILIES.has(entry.family)) problems.push(`${at}.family must be one of ${[...FAMILIES].join(", ")}`);
  });
}

if (problems.length > 0) {
  console.error("ecosystem.json is not valid:");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log(`ecosystem.json is valid, ${doc.entries.length} entries`);
```

- [ ] **Step 4: Run the validator against the document**

Run: `cd ../half-built-ecosystem-data && node validate.mjs`
Expected: `ecosystem.json is valid, 5 entries`

- [ ] **Step 5: Prove the validator catches a real mistake**

Temporarily change `"priority": 0` to `"priority": "0"` in `ecosystem.json`, then run the validator again.

Run: `node validate.mjs`
Expected: exit code 1 and `entries[0].priority must be a number`

Restore the file to the correct value and re-run to confirm it passes again. Do not commit the broken form.

- [ ] **Step 6: Write the README**

Create `../half-built-ecosystem-data/README.md`:

```markdown
# half-built-ecosystem-data

The list of web properties in the half-built family, served as one JSON
document so every site can render the others without hardcoding them.

Consumed at runtime by the footer island in `@half-built/astro`
(`scripts/ecosystem`). Design record: `2026-09-06-ecosystem-endpoint-design.md`
in the half-built-ui repo.

## The endpoint

`https://ecosystem.half-built-robots.com/ecosystem.json`

Served by a Cloudflare Pages project with no build step, production
branch `main`. `_headers` grants cross-origin reads and sets a five
minute cache with a one day stale-while-revalidate window.

## Schema

Version 1. The wrapper carries `version`, `updated` and `entries`.

| Field | Type | Meaning |
|---|---|---|
| `key` | string | Stable identifier a site matches itself against. Permanent. |
| `label` | string | The rendered text. |
| `href` | string or null | Null means the property exists but is not deployed, and it renders visible and unlinked. |
| `priority` | number | Ascending rank, 0 highest. |
| `family` | string | `half-built` or `adjacent`. Sites sort their own family first. |

Keys are permanent. Renaming a property means a new key, because a site
matching the old key would otherwise vanish from its own footer.

## Changing the list

Edit `ecosystem.json`, run `node validate.mjs`, commit, push. The Pages
project deploys automatically and the change is live within minutes. No
consuming site needs rebuilding.

Adding an entry that no site claims as its own is fine. Removing an
entry that a live site claims is not: that site refuses the whole
document and falls back to its built-in baseline.
```

- [ ] **Step 7: Add a gitignore**

Create `../half-built-ecosystem-data/.gitignore`:

```
node_modules/
.DS_Store
```

- [ ] **Step 8: Initialise the repo and commit**

```bash
cd ../half-built-ecosystem-data
git init
git add .
git commit -m "feat: the ecosystem document, its headers and a validator

One JSON document listing the half-built family's web properties, so
every site can render the others without hardcoding them. Serves from
a Cloudflare Pages project with cross-origin reads and a short cache
over a one day stale-while-revalidate window.

validate.mjs is a dependency-free shape check for whoever edits the
file. It duplicates the island's rules on purpose, because the two
live in different repos with no dependency between them."
```

Do not add a remote and do not push. That is an owner action.

- [ ] **Step 9: Add the repo to the workspace table**

In `../CLAUDE.md`, add a row to the table under "What this directory is", after the `curthenrichs.github.io` row:

```markdown
| `half-built-ecosystem-data/` | `curthenrichs/half-built-ecosystem-data` | The family's property list, one JSON document served to every site's footer. No build step. |
```

That file is not tracked by git, since the workspace is deliberately not a repository. Editing it is the whole step.

---

### Task 2: Validation and sorting

**Files:**
- Create: `packages/astro/src/scripts/ecosystem.ts`
- Create: `packages/astro/test/ecosystem-dom.test.ts`

**Interfaces:**
- Consumes: the document shape from Task 1.
- Produces: `EcosystemDocEntry`, `EcosystemDocument`, `validateDocument(raw: unknown): EcosystemDocument | null`, and `sortEntries(entries: EcosystemDocEntry[], selfKey: string, limit: number): EcosystemDocEntry[] | null`. Task 3 calls `validateDocument`. Task 4 calls `sortEntries`. `sortEntries` returns null when no entry matches `selfKey`, which is the refusal that keeps a site from rendering a list that omits itself.

- [ ] **Step 1: Write the failing tests**

Create `packages/astro/test/ecosystem-dom.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/astro/test/ecosystem-dom.test.ts`
Expected: FAIL, cannot resolve `../src/scripts/ecosystem`.

- [ ] **Step 3: Write the module's validation and sorting**

Create `packages/astro/src/scripts/ecosystem.ts`:

```ts
/* The ecosystem island: the footer's Ecosystem column, fetched at
   runtime from a shared document so adding a property to the family
   never means rebuilding every site (design record
   2026-09-06-ecosystem-endpoint-design.md in this repo's docs).

   The component keeps rendering its typed props, which are the static
   baseline. This island replaces that list only on a validated,
   non-empty document that contains the site's own key. Every other
   path leaves the baseline standing, so a reader with JavaScript off,
   a dead endpoint or a malformed payload sees a slightly stale footer
   rather than a blank one.

   The endpoint is a parameter. This package hardcodes no consumer URL. */

export interface EcosystemDocEntry {
  key: string;
  label: string;
  /* null: the property exists but is not deployed. Renders unlinked. */
  href: string | null;
  /* Ascending rank, 0 highest. */
  priority: number;
  family: string;
}

export interface EcosystemDocument {
  version: number;
  entries: EcosystemDocEntry[];
}

const SCHEMA_VERSION = 1;

function isEntry(value: unknown): value is EcosystemDocEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.key === "string" && entry.key !== "" &&
    typeof entry.label === "string" && entry.label !== "" &&
    (entry.href === null || typeof entry.href === "string") &&
    typeof entry.priority === "number" && Number.isFinite(entry.priority) &&
    typeof entry.family === "string" && entry.family !== ""
  );
}

/** The document, or null when anything about it is unusable. */
export function validateDocument(raw: unknown): EcosystemDocument | null {
  if (typeof raw !== "object" || raw === null) return null;
  const doc = raw as Record<string, unknown>;
  if (doc.version !== SCHEMA_VERSION) return null;
  if (!Array.isArray(doc.entries) || doc.entries.length === 0) return null;
  /* filter, not every: a type predicate narrows the array through
     filter and does not through every, so this is the form that hands
     back EcosystemDocEntry[] instead of any[]. Comparing lengths is
     what makes it a refusal rather than a silent drop of bad rows. */
  const entries = doc.entries.filter(isEntry);
  if (entries.length !== doc.entries.length) return null;
  return { version: SCHEMA_VERSION, entries };
}

/** The self entry's family first, each group by ascending priority and
    then label, capped at limit. Null when selfKey is absent, which is
    the refusal that keeps a site out of a list missing itself. */
export function sortEntries(
  entries: EcosystemDocEntry[],
  selfKey: string,
  limit: number,
): EcosystemDocEntry[] | null {
  const self = entries.find((entry) => entry.key === selfKey);
  if (!self) return null;
  const own = self.family;
  return [...entries]
    .sort((a, b) => {
      const aOwn = a.family === own ? 0 : 1;
      const bOwn = b.family === own ? 0 : 1;
      if (aOwn !== bOwn) return aOwn - bOwn;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.label.localeCompare(b.label);
    })
    .slice(0, limit);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/astro/test/ecosystem-dom.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Lint**

Run: `npx eslint packages/astro/src/scripts/ecosystem.ts packages/astro/test/ecosystem-dom.test.ts`
Expected: clean, no output.

- [ ] **Step 6: Commit**

```bash
git add packages/astro/src/scripts/ecosystem.ts packages/astro/test/ecosystem-dom.test.ts
git commit -m "feat(astro): ecosystem document validation and sorting

The pure half of the ecosystem island. validateDocument refuses an
unknown version, a missing or empty entries array, and any entry with
a bad field. sortEntries puts the self entry's own family first, each
group by ascending priority then label, and returns null when no entry
matches the self key, which is the refusal that keeps a site from
rendering a list that omits itself."
```

---

### Task 3: Fetch with retry and the last-known-good cache

**Files:**
- Modify: `packages/astro/src/scripts/ecosystem.ts`
- Modify: `packages/astro/test/ecosystem-dom.test.ts`

**Interfaces:**
- Consumes: `validateDocument` from Task 2.
- Produces: `loadDocument(endpoint: string, storage: Storage | null, now: number, retryDelaysMs: number[]): Promise<EcosystemDocument | null>`. Task 4 calls it. It performs the fetch with retry, writes the cache on success, and reads the cache when every attempt fails.

The rule that matters here: retry transport failures, never content failures. A network error, a timeout, a 429 or a 5xx can genuinely differ next time. A 404 means the URL is wrong. A 200 carrying an unusable body returns the same bytes on a second attempt.

- [ ] **Step 1: Write the failing tests**

Append to `packages/astro/test/ecosystem-dom.test.ts`. Also extend the import at the top of the file to `import { validateDocument, sortEntries, loadDocument } from "../src/scripts/ecosystem";` and add `beforeEach`, `afterEach` and `vi` to the vitest import.

```ts
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
  } as Storage;
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/astro/test/ecosystem-dom.test.ts`
Expected: FAIL, `loadDocument` is not exported.

- [ ] **Step 3: Implement the fetch layer**

Append to `packages/astro/src/scripts/ecosystem.ts`:

```ts
const CACHE_KEY = "half-built-ecosystem";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ATTEMPT_TIMEOUT_MS = 3000;
const RETRY_DELAYS_MS = [400, 1200];
const JITTER_MS = 250;

/* A transport failure can differ on a second attempt. A content
   failure cannot, so it is reported separately and never retried. */
type Attempt =
  | { kind: "body"; body: unknown }
  | { kind: "transport"; status: number | null }
  | { kind: "content" };

function retryable(status: number | null): boolean {
  if (status === null) return true;
  if (status === 429) return true;
  return status >= 500 && status <= 599;
}

function sleep(ms: number): Promise<void> {
  const jitter = ms === 0 ? 0 : Math.random() * JITTER_MS;
  return new Promise((resolve) => setTimeout(resolve, ms + jitter));
}

async function attemptFetch(endpoint: string): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); }, ATTEMPT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(endpoint, { signal: controller.signal, credentials: "omit" });
  } catch {
    return { kind: "transport", status: null };
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) return { kind: "transport", status: response.status };
  let text: string;
  try {
    text = await response.text();
  } catch {
    return { kind: "transport", status: null };
  }
  try {
    return { kind: "body", body: JSON.parse(text) as unknown };
  } catch {
    /* Parsed nothing usable. The same bytes come back next time. */
    return { kind: "content" };
  }
}

function readCache(storage: Storage | null, now: number): EcosystemDocument | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.fetchedAt !== "number") return null;
    if (now - record.fetchedAt > CACHE_TTL_MS) return null;
    /* Storage is untrusted input, so it runs the same gate as a fetch. */
    return validateDocument(record.document);
  } catch {
    return null;
  }
}

function writeCache(storage: Storage | null, now: number, document: EcosystemDocument): void {
  if (!storage) return;
  try {
    storage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: now, document }));
  } catch {
    /* A private window or blocked site data. The fetch still stands. */
  }
}

/** Fetch with retry, falling back to the last known good copy. Null
    when neither yields a usable document. */
export async function loadDocument(
  endpoint: string,
  storage: Storage | null,
  now: number,
  retryDelaysMs: number[] = RETRY_DELAYS_MS,
): Promise<EcosystemDocument | null> {
  /* One attempt up front, then one per configured delay. Iterating the
     delays rather than indexing them keeps this free of the array
     index access that reads as possibly undefined under the strict
     project and as definitely defined under the lint project. */
  for (const delay of [0, ...retryDelaysMs]) {
    await sleep(delay);
    const result = await attemptFetch(endpoint);
    if (result.kind === "body") {
      const document = validateDocument(result.body);
      if (document) {
        writeCache(storage, now, document);
        return document;
      }
      break;
    }
    if (result.kind === "content") break;
    if (!retryable(result.status)) break;
  }
  return readCache(storage, now);
}
```

Note the loop's exits. A content failure and an unretryable status both break to the cache read, which is correct: those say the live document is unusable, and a good copy from yesterday still beats the two-entry baseline.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run packages/astro/test/ecosystem-dom.test.ts`
Expected: PASS, 20 tests.

- [ ] **Step 5: Lint and typecheck**

Run: `npx eslint packages/astro/src/scripts/ecosystem.ts packages/astro/test/ecosystem-dom.test.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/astro/src/scripts/ecosystem.ts packages/astro/test/ecosystem-dom.test.ts
git commit -m "feat(astro): ecosystem fetch with retry and last known good

Three attempts with jittered backoff, and the rule that decides what
retries: a network error, a timeout, a 429 or a 5xx can differ next
time, a 404 means the URL is wrong, and a 200 carrying an unusable
body returns the same bytes. The tests assert the call count on both
no-retry paths, since that behavior regresses silently.

A successful fetch is cached with its timestamp and serves as the
fallback when a later load fails outright, while it is younger than
the edge's own stale-while-revalidate window. The cached copy runs the
same validation as a fetched one, because storage is untrusted input."
```

---

### Task 4: The render, the mount, and the Footer hook

**Files:**
- Modify: `packages/astro/src/scripts/ecosystem.ts`
- Modify: `packages/astro/src/components/Footer.astro`
- Modify: `packages/astro/test/ecosystem-dom.test.ts`
- Modify: `packages/astro/README.md`

**Interfaces:**
- Consumes: `loadDocument` from Task 3 and `sortEntries` from Task 2.
- Produces: `mountEcosystem(root: Document, opts: { endpoint: string; selfKey: string; limit?: number; retryDelaysMs?: number[] }): Promise<void>`, which Task 5 calls. Also the `data-ecosystem` attribute on the Footer's ecosystem list, which is the element the island finds.

The render must reproduce the three states the component already renders, so a swapped list is indistinguishable from the server-rendered one: the self key as `<span class="footer-sitemap-self">`, a non-null href as `<a>`, and a null href as `<span class="footer-sitemap-pending">`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/astro/test/ecosystem-dom.test.ts`, and extend the module import to include `mountEcosystem`.

```ts
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replaces the baseline with the fetched list in sorted order", async () => {
    const list = mountFixture();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));
    await mountEcosystem(document, { endpoint: "https://e.test/x.json", selfKey: "ui", retryDelaysMs: NO_DELAY });
    expect([...list.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
      "Half-Built Robots", "The Bead Reserve", "half-built-ui", "Portfolio", "Okos Polip",
    ]);
  });

  it("renders the three states the component renders", async () => {
    const list = mountFixture();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));
    await mountEcosystem(document, { endpoint: "https://e.test/x.json", selfKey: "ui", retryDelaysMs: NO_DELAY });
    expect(list.querySelector(".footer-sitemap-self")?.textContent).toBe("half-built-ui");
    expect(list.querySelector('a[href="https://half-built-robots.com/"]')).not.toBeNull();
    /* Two undeployed properties, both visible and unlinked. */
    expect(list.querySelectorAll(".footer-sitemap-pending")).toHaveLength(2);
  });

  it("honours the limit", async () => {
    const list = mountFixture();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(DOC)));
    await mountEcosystem(document, { endpoint: "https://e.test/x.json", selfKey: "ui", limit: 2, retryDelaysMs: NO_DELAY });
    expect(list.querySelectorAll("li")).toHaveLength(2);
  });

  it("leaves the baseline alone when the fetch fails outright", async () => {
    const list = mountFixture();
    const before = list.innerHTML;
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await mountEcosystem(document, { endpoint: "https://e.test/x.json", selfKey: "ui", retryDelaysMs: NO_DELAY });
    expect(list.innerHTML).toBe(before);
  });

  it("leaves the baseline alone when the document omits this site", async () => {
    const list = mountFixture();
    const before = list.innerHTML;
    const without = { ...DOC, entries: DOC.entries.filter((e) => e.key !== "ui") };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(without)));
    await mountEcosystem(document, { endpoint: "https://e.test/x.json", selfKey: "ui", retryDelaysMs: NO_DELAY });
    expect(list.innerHTML).toBe(before);
  });

  it("does nothing at all when the page has no ecosystem list", async () => {
    document.body.innerHTML = "<p>no footer here</p>";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await mountEcosystem(document, { endpoint: "https://e.test/x.json", selfKey: "ui", retryDelaysMs: NO_DELAY });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run packages/astro/test/ecosystem-dom.test.ts`
Expected: FAIL, `mountEcosystem` is not exported.

- [ ] **Step 3: Implement the render and mount**

Append to `packages/astro/src/scripts/ecosystem.ts`:

```ts
const DEFAULT_LIMIT = 6;

export interface EcosystemOptions {
  /* The document's URL. This package ships no default: a consumer
     passes its own, so the package reads no consumer configuration. */
  endpoint: string;
  /* The entry this site renders as itself, unlinked and bold. */
  selfKey: string;
  limit?: number;
  retryDelaysMs?: number[];
}

function entryNode(doc: Document, entry: EcosystemDocEntry, selfKey: string): HTMLElement {
  if (entry.key === selfKey) {
    const self = doc.createElement("span");
    self.className = "footer-sitemap-self";
    self.textContent = entry.label;
    return self;
  }
  if (entry.href !== null) {
    const link = doc.createElement("a");
    link.href = entry.href;
    link.textContent = entry.label;
    return link;
  }
  const pending = doc.createElement("span");
  pending.className = "footer-sitemap-pending";
  pending.textContent = entry.label;
  return pending;
}

function safeStorage(view: Window | null): Storage | null {
  try {
    return view?.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Replace the footer's ecosystem list with the shared document's, or
    leave the server-rendered baseline exactly as it is. */
export async function mountEcosystem(root: Document, opts: EcosystemOptions): Promise<void> {
  const { endpoint, selfKey, limit = DEFAULT_LIMIT, retryDelaysMs } = opts;
  const list = root.querySelector<HTMLElement>("[data-ecosystem]");
  if (!list) return;

  const storage = safeStorage(root.defaultView);
  const document_ = await loadDocument(endpoint, storage, Date.now(), retryDelaysMs);
  if (!document_) return;

  const entries = sortEntries(document_.entries, selfKey, limit);
  if (!entries || entries.length === 0) return;

  const fragment = root.createDocumentFragment();
  for (const entry of entries) {
    const item = root.createElement("li");
    item.append(entryNode(root, entry, selfKey));
    fragment.append(item);
  }
  list.replaceChildren(fragment);
}
```

- [ ] **Step 4: Add the Footer hook**

In `packages/astro/src/components/Footer.astro`, find the ecosystem group's list, which currently reads `<ul>` immediately after the `<summary>` containing `{ecosystemTitle}`. Change that one opening tag to:

```astro
          <ul data-ecosystem>
```

Nothing else in the component changes. It keeps taking `ecosystem` and `ecosystemSelf` as typed props, and those props remain the rendered output when no island runs. The attribute is additive, so a consumer that never mounts the island renders exactly what it renders today.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run packages/astro/test/ecosystem-dom.test.ts`
Expected: PASS, 26 tests.

- [ ] **Step 6: Run the whole suite, lint and the site build**

Run: `npm test`
Expected: all files pass, no regressions.

Run: `npx eslint .`
Expected: clean.

Run: `npm run build:site`
Expected: Complete.

- [ ] **Step 7: Document the island in the package README**

In `packages/astro/README.md`, add this section immediately before `## Import notes`:

```markdown
## Ecosystem island

`scripts/ecosystem` fills the Footer's Ecosystem column from a shared
JSON document, so adding a property to a family of sites does not mean
rebuilding every one of them.

```js
import { mountEcosystem } from "@half-built/astro/scripts/ecosystem";

void mountEcosystem(document, {
  endpoint: "https://example.com/ecosystem.json",
  selfKey: "ui",
});
```

The endpoint is a parameter and the package ships no default. `Footer`
keeps taking `ecosystem` and `ecosystemSelf` as typed props, and those
props are the static baseline the island replaces. Every failure path
leaves that baseline standing: no JavaScript, a dead endpoint, a
malformed payload, or a document that does not contain `selfKey`.

The document is `{ version: 1, entries: [...] }` where each entry has
`key`, `label`, `href` (null renders unlinked), `priority` (ascending,
0 highest) and `family`. Entries are sorted with the self entry's own
family first, then by priority, and capped at `limit`, default 6.
```

- [ ] **Step 8: Commit**

```bash
git add packages/astro/src/scripts/ecosystem.ts packages/astro/src/components/Footer.astro packages/astro/test/ecosystem-dom.test.ts packages/astro/README.md
git commit -m "feat(astro): the ecosystem island renders into the footer

mountEcosystem finds the Footer's ecosystem list, loads the shared
document, sorts it for the calling site and re-renders. It reproduces
the three states the component already renders, so a swapped list is
indistinguishable from the server-rendered one, and it returns without
touching the DOM on every refusal path.

Footer gains a data-ecosystem attribute and nothing else. The change
is additive, so a consumer that never mounts the island renders what
it renders today, and the blog's parity check at its next pin bump
should show no movement from this."
```

---

### Task 5: Wire the ui site

**Files:**
- Create: `site/src/lib/ecosystem-config.ts`
- Modify: `site/src/data/site.ts`
- Modify: `site/src/layouts/Base.astro`
- Modify: `site/test/browser.test.ts`

**Interfaces:**
- Consumes: `mountEcosystem` from Task 4.
- Produces: nothing later tasks use. This is the first consumer.

The ui site's current ecosystem data is wrong in a way this task fixes. It lists the site itself and its own GitHub repo, which are not properties of the family, and its self key is `site` where the shared document uses `ui`.

- [ ] **Step 1: Create the client-side config module**

Create `site/src/lib/ecosystem-config.ts`:

```ts
/* Split out the way theme-key.ts and palette-key.ts are: Base.astro's
   body-end script imports these two constants, and importing all of
   data/site.ts client-side to reach them would drag the nav, the
   sitemap and the social icon markup into the bundle for nothing. */

/* Matches the shared document's key for this site. */
export const ECOSYSTEM_SELF_KEY = "ui";

/* Null until the Pages project and the CNAME exist, which are owner
   actions. While it is null the island never mounts and the site makes
   no request, so going live is this one line. */
export const ECOSYSTEM_ENDPOINT: string | null = null;
```

- [ ] **Step 2: Correct the baseline data**

In `site/src/data/site.ts`, add the import beside the existing ones:

```ts
import { ECOSYSTEM_SELF_KEY } from "../lib/ecosystem-config";
```

Then replace the `ECOSYSTEM` and `ECOSYSTEM_SELF` declarations with:

```ts
/* The satellite baseline (design record 2026-09-06-ecosystem-endpoint):
   this site plus a pointer home to the blog. The island replaces the
   list with the shared document at runtime; this is what renders with
   JavaScript off, during an outage, or before the endpoint exists.
   Two entries, so it cannot drift far from the truth. */
export const ECOSYSTEM: EcosystemEntry[] = [
  { key: "ui", label: SITE_NAME, href: "/" },
  { key: "blog", label: "Half-Built Robots", href: "https://half-built-robots.com/" },
];

/* One definition, in lib/ecosystem-config.ts, which the client script
   also reads. */
export const ECOSYSTEM_SELF = ECOSYSTEM_SELF_KEY;
```

- [ ] **Step 3: Mount the island**

In `site/src/layouts/Base.astro`, inside the body-end `<script>` block, add the imports beside the others and the guarded call after `mountTokenHexes(document);`:

```ts
      import { mountEcosystem } from "@half-built/astro/scripts/ecosystem";
      import { ECOSYSTEM_SELF_KEY, ECOSYSTEM_ENDPOINT } from "../lib/ecosystem-config";
```

```ts
      /* Guarded, so a site with no endpoint configured makes no
         request at all. Bundlers drop the island entirely while the
         constant is null. */
      if (ECOSYSTEM_ENDPOINT !== null) {
        void mountEcosystem(document, { endpoint: ECOSYSTEM_ENDPOINT, selfKey: ECOSYSTEM_SELF_KEY });
      }
```

- [ ] **Step 4: Write the failing browser test**

In `site/test/browser.test.ts`, add this test immediately before the `"the toc renders one link per section"` test:

```ts
  it("the footer's ecosystem list carries the island's hook and the baseline", async () => {
    const p = await open();
    /* The hook is what mountEcosystem finds. The baseline is what
       renders until the endpoint exists, and with JavaScript off
       forever: this site plus a pointer home to the blog. */
    const list = await p.$("footer [data-ecosystem]");
    expect(list, "the footer has no data-ecosystem hook").not.toBeNull();
    const items = await p.$$eval("footer [data-ecosystem] li", (els) =>
      els.map((el) => el.textContent?.trim() ?? ""));
    expect(items).toEqual(["half-built-ui", "Half-Built Robots"]);
    const self = await p.$$eval("footer [data-ecosystem] .footer-sitemap-self", (els) =>
      els.map((el) => el.textContent?.trim() ?? ""));
    expect(self).toEqual(["half-built-ui"]);
  }, 30_000);
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm run build:site` then `BROWSER_TESTS=1 npm run test:browser`
Expected: FAIL on the new test, because the build predates the data change or the hook.

If the port is held by a stale preview server, free it first:

```bash
for pid in $(netstat -ano | grep ":4327.*LISTENING" | awk '{print $5}' | sort -u); do taskkill //PID $pid //T //F; done
```

- [ ] **Step 6: Rebuild and run the full gates**

Run: `npm test`
Expected: pass.

Run: `npx eslint .`
Expected: clean.

Run: `npx tsc -p site --noEmit`
Expected: clean.

Run: `npm run build:site`
Expected: Complete.

Run: `BROWSER_TESTS=1 npm run test:browser`
Expected: all pass including the new test.

- [ ] **Step 7: Commit**

```bash
git add site/src/lib/ecosystem-config.ts site/src/data/site.ts site/src/layouts/Base.astro site/test/browser.test.ts
git commit -m "feat(site): the ui site joins the shared ecosystem

Its ecosystem data was wrong: it listed the site itself and its own
GitHub repo, which are not properties of the family, under a self key
of 'site' where the shared document uses 'ui'. It now carries the
satellite baseline, itself plus a pointer home to the blog, which is
what renders with JavaScript off and during an outage.

The island mount is guarded on ECOSYSTEM_ENDPOINT, which is null until
the Pages project and CNAME exist. While it is null the site makes no
request and bundlers drop the island, so going live is one line."
```

---

### Task 6: Record the state of play

**Files:**
- Modify: `docs/superpowers/specs/2026-09-06-ecosystem-endpoint-design.md`

**Interfaces:**
- Consumes: the outcome of Tasks 1 through 5.
- Produces: nothing. This closes the loop for whoever picks the work up.

- [ ] **Step 1: Update the spec's status line**

Change the status line under the title from:

```markdown
Date: 2026-09-06. Status: approved direction, pre-implementation.
```

to:

```markdown
Date: 2026-09-06. Status: package and ui site IMPLEMENTED. The data
repo exists locally at ../half-built-ecosystem-data with an initial
commit and no remote. Blocked on owner actions: the GitHub remote, the
Cloudflare Pages project, the `ecosystem` CNAME, flipping
ECOSYSTEM_ENDPOINT off null, and the blog's adoption at its next pin
bump.
```

- [ ] **Step 2: Append what shipped**

Add this section at the end of the spec:

```markdown
## As implemented (2026-09-06)

- The data repo is created locally at `../half-built-ecosystem-data`
  with `ecosystem.json`, `_headers`, a dependency-free `validate.mjs`
  and a README. It has an initial commit and no remote.
- `@half-built/astro` gained `scripts/ecosystem` and a `data-ecosystem`
  attribute on the Footer's ecosystem list. The component's props are
  unchanged, so the attribute is additive and the blog's parity check
  should show no movement from it.
- The retry rule is implemented as specified: a network error, a
  timeout, a 429 and a 5xx retry across three attempts with jittered
  backoff; a 404 and any unusable body are attempted once. The tests
  assert the call count on both no-retry paths.
- The last-known-good cache lives under `half-built-ecosystem` in
  `localStorage`, is used only when a load fails outright, and is
  revalidated on read.
- The ui site carries the satellite baseline and a guarded mount.
  `ECOSYSTEM_ENDPOINT` is null, so it currently makes no request.

Not done, and not attemptable without owner credentials: the GitHub
remote and push, the Pages project, the CNAME, and the blog's pin bump
and wiring.
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-06-ecosystem-endpoint-design.md
git commit -m "docs: record what the ecosystem work shipped

The package and the ui site are implemented and gated. The data repo
is local with no remote. Everything left is an owner action with
credentials this work does not have."
```

---

## Self-Review

**Spec coverage.** Walked each spec section against the tasks. The
document and its fields, the hosting files and headers: Task 1. The
Footer hook and the island's API, sorting and rendering: Tasks 2 and 4.
Retry and last known good: Task 3. Degradation's four layers: layer 1
is the `_headers` file in Task 1, layers 2 and 3 are Task 3, layer 4 is
the baseline in Task 5 plus every refusal path tested in Tasks 3 and 4.
Consumers and rollout: Task 5 covers the ui site; the blog, BEADZ, the
remote, the Pages project and the CNAME are listed under owner actions
because they need credentials or a published release. Testing: the
spec's unit, retry and cache bullets map to Tasks 2 through 4. The
spec's browser bullet asked for a stubbed-endpoint test proving the
list updates; that is deliberately reduced to a hook-and-baseline
assertion in Task 5, because the endpoint constant is null and an
end-to-end browser test would be exercising wiring that is switched
off. Recorded as a follow-up in Task 6 rather than silently dropped.

**Placeholder scan.** No TBDs, no "add error handling", no "similar to
Task N". Every code step carries the code. The one deliberate
truncation is the Footer edit in Task 4 Step 4, which names the exact
tag to change rather than reproducing the component.

**Type consistency.** `EcosystemDocEntry` and `EcosystemDocument` are
defined in Task 2 and used unchanged in Tasks 3 and 4.
`validateDocument` returns `EcosystemDocument | null` everywhere.
`sortEntries` returns `EcosystemDocEntry[] | null` and both callers
check for null. `loadDocument`'s signature in Task 3's Interfaces block
matches its implementation and Task 4's call. `mountEcosystem`'s
options match between Task 4's implementation, its tests and Task 5's
call site. The cache key string `half-built-ecosystem` is identical in
the implementation and in the stale-schema test.
