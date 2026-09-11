/* Split out the way theme-key.ts and palette-key.ts are: Base.astro's
   body-end script imports these two constants, and importing all of
   data/site.ts client-side to reach them would drag the nav, the
   sitemap and the social icon markup into the bundle for nothing. */

/* Matches the shared document's key for this site. */
export const ECOSYSTEM_SELF_KEY = "ui";

/* Live since 2026-09-07: the half-built-ecosystem-data Pages project
   serves this with Access-Control-Allow-Origin *. Setting it back to
   null is the kill switch, and a clean one: the island never mounts,
   the site makes no request, and the server-rendered baseline in
   data/site.ts is what ships. The same baseline stands whenever the
   fetch fails, so a bad day at the endpoint costs the site nothing. */
export const ECOSYSTEM_ENDPOINT: string | null =
  "https://ecosystem.half-built-robots.com/ecosystem.json";
