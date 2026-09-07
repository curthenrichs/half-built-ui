/* The rail's scroll-spy and the phone Sections panel (owner call
   2026-09-06, the Toolbar/Toc merge): one IntersectionObserver over
   every section[id], marking the matching link in BOTH of the rail's
   navs with aria-current (the desktop list and the corner cluster's
   panel render the same links, so each id maps to more than one
   anchor). The panel gets the same popup manners as the palette
   panel: the corner X, a click outside, and Escape close it, and so
   does following a link. Site-local, like palette-editor.ts; this
   page's Rail.astro is the only consumer. */
export function mountToc(root: Document): void {
  const links = new Map<string, HTMLAnchorElement[]>();
  root.querySelectorAll<HTMLAnchorElement>(".site-rail nav a[href^='#']").forEach((anchor) => {
    const id = anchor.hash.slice(1);
    if (!id) return;
    const list = links.get(id) ?? [];
    list.push(anchor);
    links.set(id, list);
  });
  const sections = root.querySelectorAll("section[id]");
  if (links.size === 0 || sections.length === 0) return;

  const setCurrent = (id: string): void => {
    links.forEach((anchors, linkId) => {
      for (const anchor of anchors) {
        if (linkId === id) anchor.setAttribute("aria-current", "true");
        else anchor.removeAttribute("aria-current");
      }
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const intersecting = entries.filter((entry) => entry.isIntersecting);
      if (intersecting.length === 0) return;
      const last = intersecting[intersecting.length - 1];
      setCurrent(last.target.id);
    },
    { rootMargin: "-40% 0px -55% 0px" },
  );
  sections.forEach((section) => {
    observer.observe(section);
  });

  /* The observer only speaks when a section crosses its middle band,
     so a reader who has not scrolled yet saw no current section at
     all: the rail opened with nothing marked (owner catch
     2026-09-06). Mark the section the page opens on, and let the
     observer take it from there. */
  const viewportH = root.defaultView?.innerHeight ?? 0;
  let openingId = "";
  for (const section of sections) {
    /* The first section seeds the value, then every section already
       past the band overwrites it, so this ends on the last one the
       page opens against. No index access, which keeps the check
       honest under both the strict and the lint type projects. */
    if (openingId === "" || section.getBoundingClientRect().top <= viewportH * 0.45) {
      openingId = section.id;
    }
  }
  setCurrent(openingId);

  const panel = root.querySelector<HTMLElement>("[data-rail-sections]");
  if (!(panel instanceof HTMLDetailsElement)) return;
  const closePanel = (): void => {
    panel.open = false;
  };
  panel.querySelector<HTMLButtonElement>("[data-sections-close]")?.addEventListener("click", closePanel);
  panel.querySelectorAll<HTMLAnchorElement>("nav a").forEach((anchor) => {
    anchor.addEventListener("click", closePanel);
  });
  root.addEventListener("click", (e) => {
    if (!panel.open) return;
    if (e.target instanceof Node && !panel.contains(e.target)) closePanel();
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel();
  });
}
