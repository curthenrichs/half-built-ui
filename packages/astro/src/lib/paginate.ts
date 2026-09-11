export function paginatePosts<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }

  return pages;
}

/* Canonical href for an archive page: page 1 is the archive root, deeper
   pages live at /page/N/ (trailing slash, site-wide rule). base is the
   archive's root without its trailing slash ("" for the site root,
   "/category/robots" for a category); Pagination.astro and the post
   back link both call this so the rule exists once. */
export function archivePagePath(page: number, base = ""): string {
  return page <= 1 ? `${base}/` : `${base}/page/${page}/`;
}
