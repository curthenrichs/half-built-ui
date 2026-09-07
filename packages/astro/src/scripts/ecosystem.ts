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
