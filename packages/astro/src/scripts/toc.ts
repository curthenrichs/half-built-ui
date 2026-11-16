/* The page TOC island (#438), grown from the demo site's rail TOC.
   Toc.astro renders a zero-height sticky anchor at the top of the
   content column, and CSS hangs the list off it into the gutter, so
   keeping it on screen is the stylesheet's job. This script does the
   rest:
   - Mode. With at least TOC_STRIP_MIN_GUTTER px between the anchor
     and the viewport's left edge the list sits open in that strip
     (data-toc-mode="strip"); with less it collapses to a Sections tab
     that slides the list out as a panel ("tab"). The measured gap is
     written to --toc-edge for the stylesheet. Re-measured on resize.
   - Tracking. One IntersectionObserver over the elements the TOC's
     links name, marking the current link with aria-current. Inside an
     h3, the h2 above it gets data-toc-parent-current, not a second
     aria-current, so assistive tech hears one current section.
   - The panel's manners, tab mode only: following a link, a click
     outside, the close button, and Escape close it; Escape returns
     focus to the tab.
   Without the script the anchor carries no mode and the stylesheet
   hides it: the tab and panel cannot work without it. */
export const TOC_STRIP_MIN_GUTTER = 220;

export function mountToc(root: Document): void {
  const toc = root.querySelector<HTMLElement>("[data-toc]");
  const view = root.defaultView;
  if (!toc || !view) return;

  const tab = toc.querySelector<HTMLButtonElement>("[data-toc-tab]");

  /* Each id maps to its link, and each h3 link to its h2's link (the
     link in the closest li around the h3's own list). Ids are looked
     up with getElementById, never a selector, so a slug like
     "0.17-release" works; a link with no target on the page is
     skipped. */
  const links = new Map<string, HTMLAnchorElement>();
  const parents = new Map<HTMLAnchorElement, HTMLAnchorElement>();
  const targets: HTMLElement[] = [];

  toc.querySelectorAll<HTMLAnchorElement>("nav a[href^='#']").forEach((a) => {
    const id = decodeURIComponent(a.hash.slice(1));
    const target = id ? root.getElementById(id) : null;
    if (!target) return;
    links.set(id, a);
    targets.push(target);

    const parent = a.closest("li")?.parentElement?.closest("li");
    const parentLink = parent?.querySelector<HTMLAnchorElement>(":scope > a");
    if (parentLink) parents.set(a, parentLink);
  });

  const isOpen = (): boolean => toc.hasAttribute("data-toc-open");

  const setOpen = (open: boolean): void => {
    toc.toggleAttribute("data-toc-open", open);
    tab?.setAttribute("aria-expanded", String(open));
  };

  const measure = (): void => {
    const edge = Math.round(toc.getBoundingClientRect().left);
    const mode = edge >= TOC_STRIP_MIN_GUTTER ? "strip" : "tab";
    toc.style.setProperty("--toc-edge", `${String(edge)}px`);
    if (toc.dataset.tocMode !== mode && isOpen()) setOpen(false);
    toc.dataset.tocMode = mode;
  };

  measure();

  let frame = false;

  view.addEventListener("resize", () => {
    if (frame) return;
    frame = true;

    view.requestAnimationFrame(() => {
      frame = false;
      measure();
    });
  });

  tab?.addEventListener("click", () => {
    setOpen(!isOpen());
  });

  toc.querySelector("[data-toc-close]")?.addEventListener("click", () => {
    setOpen(false);
  });

  links.forEach((a) => {
    a.addEventListener("click", () => {
      if (isOpen()) setOpen(false);
    });
  });

  root.addEventListener("click", (e) => {
    if (!isOpen()) return;
    if (e.target instanceof Node && !toc.contains(e.target)) setOpen(false);
  });

  root.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !isOpen()) return;
    setOpen(false);
    tab?.focus();
  });

  if (targets.length === 0) return;

  const setCurrent = (id: string): void => {
    const currentLink = links.get(id);
    const parentLink = currentLink ? parents.get(currentLink) : undefined;

    links.forEach((a) => {
      if (a === currentLink) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
      a.toggleAttribute("data-toc-parent-current", a === parentLink);
    });
  };

  /* An anchor jump lands the target's top at the viewport top, above
     the band below, so a section shorter than that offset handed the
     highlight to the next one down (owner catch 2026-09-06, on the
     demo's rail TOC). A jump marks its own target and holds the
     observer quiet until the scroll settles. */
  let quietUntil = 0;

  const observer = new IntersectionObserver(
    (entries) => {
      if (Date.now() < quietUntil) return;
      const intersecting = entries.filter((entry) => entry.isIntersecting);
      const last = intersecting.at(-1);
      if (last) setCurrent(last.target.id);
    },
    { rootMargin: "-40% 0px -55% 0px" },
  );

  targets.forEach((target) => {
    observer.observe(target);
  });

  /* The observer only speaks when a heading crosses its band, so a
     reader who has not scrolled yet would see nothing marked (owner
     catch 2026-09-06). Mark the last heading at or above 45% of the
     viewport, or the first one if none is. */
  const band = view.innerHeight * 0.45;
  let openingId = "";

  for (const target of targets) {
    if (openingId === "" || target.getBoundingClientRect().top <= band) {
      openingId = target.id;
    }
  }

  setCurrent(openingId);

  const markHash = (): void => {
    const id = decodeURIComponent(view.location.hash.slice(1));
    if (!links.has(id)) return;
    quietUntil = Date.now() + 900;
    setCurrent(id);
  };

  view.addEventListener("hashchange", markHash);
  markHash();
}
