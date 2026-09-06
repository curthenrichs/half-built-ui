/* The page's anchored sections, in the order they render (step 1, Task
   4). One list feeds both the <section id> headings in index.astro and
   the TOC's links, so the two can never drift apart. */
export interface SectionEntry {
  id: string;
  title: string;
}

export const SECTIONS: SectionEntry[] = [
  { id: "intro", title: "About" },
  { id: "frame", title: "Frame" },
  { id: "cards", title: "Cards" },
  { id: "navigation", title: "Navigation" },
  { id: "widgets", title: "Widgets" },
  { id: "content", title: "Content blocks" },
  { id: "css", title: "CSS primitives" },
];
