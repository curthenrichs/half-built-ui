/* The page TOC's data: a page's headings as one or two levels,
   never the full tree. TocHeading is structurally Astro's
   MarkdownHeading, so render()'s headings pass straight in; a page
   with hand-built sections maps its own list to the same shape.

   An h3 that comes before the first h2 has no parent to sit under, so
   it is dropped rather than promoted: posts open with an h2 in
   practice, and a promoted h3 would read as a peer of the h2s. */
export interface TocHeading {
  depth: number;
  slug: string;
  text: string;
}

export interface TocItem {
  id: string;
  text: string;
  children: TocItem[];
}

export function tocFromHeadings(
  headings: readonly TocHeading[],
  options: { depth?: 2 | 3 } = {},
): TocItem[] {
  const maxDepth = options.depth ?? 3;
  const items: TocItem[] = [];
  let parent: TocItem | undefined;

  for (const heading of headings) {
    if (heading.depth < 2 || heading.depth > maxDepth) continue;

    const item: TocItem = {
      id: heading.slug,
      text: heading.text,
      children: [],
    };

    if (heading.depth === 2) {
      items.push(item);
      parent = item;
    } else {
      parent?.children.push(item);
    }
  }

  return items;
}
