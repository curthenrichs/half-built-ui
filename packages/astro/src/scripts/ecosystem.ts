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
