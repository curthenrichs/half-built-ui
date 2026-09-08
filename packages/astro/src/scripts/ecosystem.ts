/* The ecosystem island: the footer's Ecosystem column, fetched at
   runtime from a shared document so adding a property to the family
   never means rebuilding every site (design record
   docs/superpowers/specs/2026-09-06-ecosystem-endpoint-design.md in
   this repo).

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
    /* href is checked by scheme, not just type, because it is assigned
       straight to link.href below. The document and the cached copy
       are both untrusted input, and a javascript: or data: URL there
       would run on the consumer's origin when clicked. */
    (entry.href === null ||
      (typeof entry.href === "string" && /^https?:\/\//i.test(entry.href))) &&
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
  /* The timer is cleared once in this single finally, which covers the
     header fetch and the body read alike: the 3 second budget bounds
     the whole attempt, not just the response headers, so a stalled
     body read still aborts instead of leaving the promise pending
     forever. */
  try {
    let response: Response;
    try {
      response = await fetch(endpoint, { signal: controller.signal, credentials: "omit" });
    } catch {
      return { kind: "transport", status: null };
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
  } finally {
    clearTimeout(timer);
  }
}

function readCache(storage: Storage | null, cacheKey: string, now: number): EcosystemDocument | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(cacheKey);
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

function writeCache(storage: Storage | null, cacheKey: string, now: number, document: EcosystemDocument): void {
  if (!storage) return;
  try {
    storage.setItem(cacheKey, JSON.stringify({ fetchedAt: now, document }));
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
  cacheKey: string = CACHE_KEY,
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
        writeCache(storage, cacheKey, now, document);
        return document;
      }
      break;
    }
    if (result.kind === "content") break;
    if (!retryable(result.status)) break;
  }
  return readCache(storage, cacheKey, now);
}

const DEFAULT_LIMIT = 6;

export interface EcosystemOptions {
  /* The document's URL. This package ships no default: a consumer
     passes its own, so the package reads no consumer configuration. */
  endpoint: string;
  /* The entry this site renders as itself, unlinked and bold. */
  selfKey: string;
  limit?: number;
  retryDelaysMs?: number[];
  /* The storage key is a mount option, not a package literal (same
     convention as theme-toggle.ts's storageKey), so a consumer can
     namespace the cache. Defaults to the current literal, which keeps
     behavior identical and lets two sites on one origin share the
     cached document, which is reasonable since it is not site-specific. */
  cacheKey?: string;
}

/* Astro compiles a component's scoped rules to `.cls[data-astro-cid-x]`,
   and it stamps that attribute at build time on markup it renders. An
   element built here with createElement never gets stamped, so it
   matches none of Footer.astro's scoped rules: the self entry loses its
   bold, a pending entry loses its dimming, and every link falls back to
   the browser's default underline. The server-rendered list is stamped,
   so the fix is to read the attribute off it and carry it onto whatever
   we create. Read rather than hardcoded, because the hash changes
   whenever the component's styles change. Consumers who render the
   footer unscoped simply have nothing to copy, and the loop is a no-op. */
function scopeOf(list: Element): string | null {
  for (const { name } of list.attributes) {
    if (name.startsWith("data-astro-cid-")) return name;
  }
  return null;
}

function entryNode(doc: Document, entry: EcosystemDocEntry, selfKey: string): HTMLElement {
  if (entry.key === selfKey) {
    const self = doc.createElement("span");
    self.className = "footer-sitemap-self";
    /* The bold is the visual "you are here"; this is the same statement
       for a screen reader, which cannot see weight. Without it the self
       entry is announced exactly like an undeployed one. */
    self.setAttribute("aria-current", "page");
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
    leave the server-rendered baseline exactly as it is.

    This deliberately does not follow the package's Island<O> contract
    from core/island.ts: it is async and returns no destroy handle,
    because there is nothing here to tear down. One consequence is that
    it has no claim() guard, so a caller that mounts it twice on the
    same document runs the fetch and the swap twice; every known
    caller mounts it once. */
export async function mountEcosystem(root: Document, opts: EcosystemOptions): Promise<void> {
  const { endpoint, selfKey, limit = DEFAULT_LIMIT, retryDelaysMs, cacheKey = CACHE_KEY } = opts;
  const list = root.querySelector<HTMLElement>("[data-ecosystem]");
  if (!list) return;

  const storage = safeStorage(root.defaultView);
  const document_ = await loadDocument(endpoint, storage, Date.now(), retryDelaysMs, cacheKey);
  if (!document_) return;

  const entries = sortEntries(document_.entries, selfKey, limit);
  if (!entries || entries.length === 0) return;

  const scope = scopeOf(list);
  const fragment = root.createDocumentFragment();
  for (const entry of entries) {
    const item = root.createElement("li");
    const node = entryNode(root, entry, selfKey);
    if (scope !== null) {
      item.setAttribute(scope, "");
      node.setAttribute(scope, "");
    }
    item.append(node);
    fragment.append(item);
  }
  list.replaceChildren(fragment);
}
