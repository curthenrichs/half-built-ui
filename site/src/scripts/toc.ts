/* Sticky scroll-spy TOC (step 3, Task 4): one IntersectionObserver over
   every section[id], marking the nav link for whichever section most
   recently crossed the middle band with aria-current. Site-local, not
   a package island: this page's Toc.astro is the only consumer. */
export function mountToc(root: Document): void {
  const links = new Map<string, HTMLAnchorElement>();
  root.querySelectorAll<HTMLAnchorElement>(".site-toc nav a[href^='#']").forEach((anchor) => {
    const id = anchor.hash.slice(1);
    if (id) links.set(id, anchor);
  });
  const sections = root.querySelectorAll("section[id]");
  if (links.size === 0 || sections.length === 0) return;

  const setCurrent = (id: string): void => {
    links.forEach((anchor, linkId) => {
      if (linkId === id) anchor.setAttribute("aria-current", "true");
      else anchor.removeAttribute("aria-current");
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
}
