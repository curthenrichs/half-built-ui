export function slugifyCategory(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* The WP-compatible date permalink is the library's documented opinion
   (owner decision 5, 2026-08-31): migrating sites keep their URLs by
   default. */
export function postPath(p: { data: { date: Date; slug: string } }): string {
  const d = p.data.date;
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `/${d.getUTCFullYear()}/${mm}/${dd}/${p.data.slug}/`;
}

/* Category archive href for a category name. base parameterizes the URL
   strategy the way postPath does not yet; the default matches this site's
   current /category/ tree. */
export function categoryPath(name: string, base = "/category"): string {
  return `${base}/${slugifyCategory(name)}/`;
}

/* Canonical href for a static page. One level of nesting exists today
   (children of policies); parent chains deeper than one are not modeled
   anywhere, so this stays flat on purpose. */
export function pagePath(p: {
  data: { slug: string; parent?: string };
}): string {
  return p.data.parent
    ? `/${p.data.parent}/${p.data.slug}/`
    : `/${p.data.slug}/`;
}

/* Canonical lookup key for an internal href: root-relative, fragment
   and query stripped, slash-terminated. An absolute href on one of the
   site's own origins reduces to its path; anything else external is
   null, as is a file-ish path (a dot in the last segment, /feed.xml),
   which names a document with no page title to reveal. */
export function internalHrefKey(
  href: string,
  origins: readonly string[] = [],
): string | null {
  let h = href;

  for (const o of origins) {
    if (h === o || h.startsWith(`${o}/`)) {
      h = h.slice(o.length) || "/";
      break;
    }
  }

  if (!h.startsWith("/") || h.startsWith("//")) return null;
  h = h.replace(/[#?].*$/, "");
  if (h === "") return "/";
  const last = h.slice(h.lastIndexOf("/") + 1);
  if (last.includes(".")) return null;
  return h.endsWith("/") ? h : `${h}/`;
}

/* Top-level path segments owned by real routes. A page slugged one of these
   (or a bare year) would shadow the archive, pagination, category, or search
   trees under the [...slug] catch-all without any build error. */
export const RESERVED_PAGE_SLUGS = new Set([
  "page",
  "category",
  "search",
  "404",
]);

/* Build-time guard for the [...slug] catch-all: rejects reserved top-level
   slugs and parent references that resolve to nothing (a typo'd parent would
   otherwise silently render the child as a top-level page). reserved is
   parameterized so a caller with a different URL strategy can supply its
   own set instead of forking the guard. */
export function assertPageRoutable(
  p: { data: { slug: string; parent?: string } },
  parent: { data: { slug: string } } | undefined,
  reserved: ReadonlySet<string> = RESERVED_PAGE_SLUGS,
): void {
  if (p.data.parent && !parent) {
    throw new Error(
      `Page "${p.data.slug}" declares parent "${p.data.parent}", which matches no page slug`,
    );
  }

  if (
    !p.data.parent &&
    (reserved.has(p.data.slug) || /^\d{4}$/.test(p.data.slug))
  ) {
    throw new Error(
      `Page slug "${p.data.slug}" collides with a reserved route`,
    );
  }
}
