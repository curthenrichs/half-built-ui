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
