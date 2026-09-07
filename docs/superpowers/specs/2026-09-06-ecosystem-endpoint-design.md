# Ecosystem Endpoint ~ One List The Family Reads

Date: 2026-09-06. Status: package and ui site IMPLEMENTED. The data
repo exists locally at ../half-built-ecosystem-data with an initial
commit and no remote. Blocked on owner actions: the GitHub remote, the
Cloudflare Pages project, the `ecosystem` CNAME, flipping
ECOSYSTEM_ENDPOINT off null, and the blog's adoption at its next pin
bump.
Owner decisions from the 2026-09-06 brainstorm are recorded inline.

## What this builds

A single hosted document listing the properties in Curt's web family,
and a client island that renders it into the footer's Ecosystem
column. Adding a property becomes one commit to one small repo rather
than an edit and a rebuild in every consuming site.

## Why now

Each site keeps its own hardcoded list, and no two agree. Read from
the working tree on 2026-09-06:

| Where | Lists | Missing |
|---|---|---|
| Blog `src/config.ts` | blog, portfolio, BEADZ (null href) | ui, okospolip |
| Portfolio `src/content/ecosystem.js` | blog, okospolip (null href) | itself, BEADZ, ui |
| ui `site/src/data/site.ts` | itself, its own GitHub repo | every actual property |
| BEADZ | nothing yet | all |

Five properties exist and every site advertises a different subset.
The ui site's entries are not properties at all, which is why its
footer now links the same GitHub repo twice. The portfolio's file
already carries a comment naming its shape as "the schema a future
shared footer will own", so this was anticipated rather than
discovered.

## Goals and non-goals

Goals:

- One document, one edit, no consumer rebuild when the list changes
  (owner call: "I dont want to have to build K sites each time I add
  a new thing to the ecosystem").
- Each site knows only its own key and renders the rest.
- Ordering that lets a site prefer its own neighbours, because footer
  space is limited.
- A footer that stays truthful with JavaScript off, with a dead
  endpoint, or with a malformed payload.

Non-goals:

- No CMS, no admin UI, no authenticated write path. The document is
  edited by hand in git.
- No per-entry descriptions, logos or metadata beyond what the footer
  renders. The footer shows a label and a link.
- The portfolio is not converted. It is a cousin with its own
  ecosystem, style and behavior (owner call 2026-09-06), so it appears
  as an entry in the data and keeps its own local list and renderer.

## The document

One JSON file. Version 1 is the whole schema:

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

Field semantics:

- `version` is the schema contract. An island that does not recognise
  the value refuses the payload rather than guessing.
- `updated` is for humans reading the raw file. Nothing parses it.
- `key` is the stable identifier a consuming site matches itself
  against. Keys never change once published; a rename is a new key.
- `label` is the rendered text.
- `href` null means the property exists but is not deployed, and the
  footer renders it visible and unlinked. That is the existing
  `EcosystemEntry` behavior and it does not change. BEADZ holds null
  until its deploy, and okospolip holds null until its domain transfer
  completes and it serves a real site rather than the current stub.
- `priority` is an ascending rank, 0 highest (owner call: blog 0,
  BEADZ and portfolio 1, okospolip 2, ui 3).
- `family` is `half-built` for the blog, BEADZ and ui, and `adjacent`
  for the portfolio and okospolip.

Not CSV. Null hrefs, the version field, and any later nesting all cost
more in CSV conventions than JSON costs in hand-editing.

## Hosting

A repo of its own, `half-built-ecosystem-data`, named so it does not
collide with this workspace directory, which is already
`half-built-ecosystem`. It holds the JSON, a `_headers` file, and a
README stating the schema and the edit-and-ship loop.

A Cloudflare Pages project builds it with no build step, production
branch `main`, serving `ecosystem.half-built-robots.com` through a
CNAME on the existing half-built-robots.com zone. The endpoint is
`https://ecosystem.half-built-robots.com/ecosystem.json`.

`_headers` carries:

```
/ecosystem.json
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=300, stale-while-revalidate=86400
```

The fetch is cross-origin from four domains, so the allow-origin
header is required rather than optional. The cache pair means an edit
is live within minutes while a Cloudflare or origin hiccup keeps
serving the last good copy for a day.

Changing the list is one commit to one repo, and the deploy is
automatic. This is deliberately not the blog: hosting it there would
gate every ecosystem edit behind the blog's deliberate dev-to-main PR
discipline, and would make the whole family's footer depend on the
blog's repo.

## Package changes

Two, both in `@half-built/astro`.

**A hook in Footer.astro.** The ecosystem `<ul>` gains
`data-ecosystem` so the island can find it. Nothing else about the
component changes. It keeps taking `ecosystem` and `ecosystemSelf` as
typed props, and those props remain the rendered output when no island
runs.

**An island, `scripts/ecosystem.ts`,** exporting:

```ts
export interface EcosystemOptions {
  endpoint: string;
  selfKey: string;
  limit?: number;
  retryDelaysMs?: number[];
}
export async function mountEcosystem(root: Document, opts: EcosystemOptions): Promise<void>
```

The package hardcodes no URL. The consuming site passes its endpoint,
so the package still reads no consumer configuration, matching the
boundary rule that a component needing site data takes it as typed
props.

Behavior:

1. Find `[data-ecosystem]`. Return if absent.
2. Fetch `endpoint`, retrying transient failures per the Retry
   section below. Each attempt carries its own AbortController
   timeout of 3 seconds.
3. Refuse the payload, leaving the DOM untouched, when every attempt
   fails and no usable cached copy exists, the JSON does not parse,
   `version` is not 1, `entries` is not a non-empty array, any entry
   fails shape validation, or no entry matches `selfKey`. The last
   rule matters: a site must never render an ecosystem list that omits
   itself.
4. Sort: entries whose `family` equals the self entry's family first,
   then the rest. Within each group, `priority` ascending, then
   `label` as a stable tiebreak.
5. Take the first `limit` entries. Default 6, which clears the current
   five with headroom.
6. Replace the list's children, reproducing the three states the
   component already renders: the self key as
   `<span class="footer-sitemap-self">`, a non-null href as `<a>`, and
   a null href as `<span class="footer-sitemap-pending">`. The swapped
   list is indistinguishable from the server-rendered one.

## Retry and last known good

Owner question 2026-09-06: a single blip should not cost a visitor the
live list for a whole page view. Two mechanisms, covering different
failures.

**Retry, for a transient failure during this page view.** Up to three
attempts. Backoff of 400ms then 1200ms, each with up to 250ms of
random jitter so a shared blip does not return as a synchronised
retry. Worst case is roughly eleven seconds, entirely in the
background, because nothing on the page waits on this and the footer
already reads correctly from its baseline.

What retries and what does not is the part worth getting right:

- Retry a network or timeout error, a 429, or any 5xx. These are
  transport problems and a second attempt can genuinely differ.
- Do not retry a 404 or any other 4xx. The URL or the deployment is
  wrong, and retrying only multiplies a request that cannot succeed.
- Do not retry a successful response carrying an unusable body.
  Malformed JSON, an unknown `version` or a failed shape check are
  content problems, and the next attempt returns the same bytes.

**Last known good, for a failure retry cannot fix.** On every
successful fetch the island writes the validated payload to
`localStorage` under `half-built-ecosystem`, with the fetch timestamp.
When every attempt fails, the island reads that copy, and uses it when
it is younger than 24 hours, which matches the edge's
stale-while-revalidate window. The cached copy runs through the same
validation as a fetched one, because storage is untrusted input and a
stale schema must not reach the DOM. Every read and write is wrapped
in try and catch, matching the palette editor's handling of a private
window or blocked site data.

The cache is a fallback only. It is never rendered ahead of the fetch,
so a visitor sees one list swap rather than two, and a change to the
document still reaches every visitor on their next page view.

## Degradation

Four layers, each covering something the others cannot:

1. The edge's stale-while-revalidate keeps serving the last good
   document for a day when the origin is unhappy.
2. Retry absorbs a transient client-side blip during a page view.
3. The cached last known good covers a sustained outage for anyone
   who loaded a page successfully in the previous day.
4. The static baseline covers JavaScript being off, a first-ever visit
   during an outage, and any refusal path above.

The props carry that static baseline, and the shape of it is hub and
spoke (owner call 2026-09-06):

- A satellite ships itself plus a pointer to the blog. Two entries.
- The blog ships itself plus ui, portfolio and BEADZ.

So a reader with JavaScript off always has a way back to the hub, and
from the hub a way out to the family. Because a satellite's baseline
is two entries, it cannot drift far from truth.

The island replaces that baseline only on a successful, validated,
non-empty fetch that includes the site's own key. Every failure path
leaves the baseline standing. The worst case is a slightly stale
footer, never a blank one.

## Consumers and rollout

Owner call: the island lands in the package directly rather than
proving out site-side first.

1. Stand up `half-built-ecosystem-data`, its Pages project, and the
   CNAME. Verify the endpoint answers with the CORS header from a
   browser on another origin.
2. Package: the Footer hook, the island, and its tests. Ships as
   0.3.0 alongside the promotions already registered for that release.
3. half-built-ui: replace its incorrect ecosystem data with the
   satellite baseline (itself plus the blog), pin 0.3.0, and mount the
   island.
4. Blog: pin 0.3.0, replace `ECOSYSTEM` with the hub baseline, mount
   the island, and run the usual parity check.
5. BEADZ: adopts at its deploy, when its entry also gains a real href.
6. Portfolio: no change. It stays an entry in the data.

Adding this repo means a sixth row in the workspace CLAUDE.md table.

## Testing

- **Unit, jsdom, in the package:** the sort against a fixture covering
  both families and a priority tie; the self entry rendering unlinked
  and bold; a null href rendering as pending; and one case per refusal
  path (network failure, unparseable body, wrong version, empty
  entries, missing self key) asserting the pre-existing DOM is
  untouched.
- **Retry, with a stubbed fetch:** a 5xx followed by a success renders
  the live list; three failures fall through to the cache or the
  baseline; a 404 is attempted exactly once; and a 200 carrying a bad
  body is attempted exactly once. The last two assert the call count,
  because "does not retry" is the behavior most likely to regress
  silently.
- **Last known good:** a successful fetch writes the payload; a later
  total failure renders from that copy; a copy older than 24 hours is
  ignored; a copy carrying a stale schema is refused by the same
  validation as a fetched one; and a throwing `localStorage` degrades
  to the baseline rather than an exception.
- **Browser, on the ui site:** the baseline renders with the island
  never mounted, and against a stubbed endpoint the list updates to
  the fetched entries in the expected order.
- **Schema:** a shared check that every site's committed baseline and
  the live document validate against the same shape, so a baseline
  cannot drift into an invalid form.

## Open owner decisions

- **okospolip's family.** Recorded as `adjacent` on the reading that
  it is a project rather than a sibling site. Worth a look before the
  data ships, because it is the one classification made without an
  explicit owner call.
- **The ui site's own priority.** Recorded as 3, the lowest. With a
  `limit` below five the ui site would be the first entry dropped from
  other footers. Intended, but worth confirming.

## Out of scope, recorded

- The portfolio's conversion to the shared list.
- Any write path more convenient than editing the file in git.
- Per-entry artwork or descriptions.

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
- A test pins that a successful fetch is always preferred over a
  present, valid cache, so the cache can never shadow fresh data.
- The ui site carries the satellite baseline and a guarded mount.
  `ECOSYSTEM_ENDPOINT` is null, so it currently makes no request.

Not done, and not attemptable without owner credentials: the GitHub
remote and push, the Pages project, the CNAME, and the blog's pin bump
and wiring.
