/* The page's anchored sections, in the order they render (step 1, Task
   4). One list feeds both the <section id> headings in index.astro and
   the TOC's links, so the two can never drift apart. */
export interface SectionEntry {
  id: string;
  title: string;
}

/* Five sections since 2026-09-06 (owner call): Navigation, Widgets and
   Content blocks merged into one Components section, because the
   components/ and content/ import split is a packaging detail and not
   a distinction a reader should have to carry. The nav mirrors the
   top four. */
export const SECTIONS: SectionEntry[] = [
  { id: "intro", title: "About" },
  { id: "frame", title: "Frame" },
  { id: "cards", title: "Cards" },
  { id: "components", title: "Components" },
  { id: "css", title: "CSS primitives" },
];
