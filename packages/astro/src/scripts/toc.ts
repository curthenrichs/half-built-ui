/* The page TOC island (#438), grown from the demo site's rail TOC.
   Toc.astro renders two forms of the same list inside a layout-free
   root (display: contents), placed under the post's title or hero:
   - the strip ([data-toc-strip]), a zero-height sticky anchor whose
     list CSS hangs open in the empty gutter left of the page;
   - the inline disclosure ([data-toc-inline]), a <details> in normal
     flow, for screens with no gutter to spare.
   This script picks one and tracks the reader:
   - Mode. The gutter is measured from the page's reference column
     (the nearest ancestor matching `column`, default ".shell", else
     the root's parent), not from the component, which sits inside the
     article's padding. With at least TOC_STRIP_MIN_GUTTER px of gutter
     it writes data-toc-mode="strip", otherwise "inline". The column's
     content edge goes to --toc-edge and the component's own offset
     inside it to --toc-inset, so the strip hangs off the column's edge.
     Re-measured on resize and when the column or the strip's panel
     changes size. The disclosure's open state is the reader's;
     the script never touches it.
   - Tracking. One IntersectionObserver over the elements the strip's
     links name, marking the current link with aria-current. Inside an
     h3, the h2 above it gets data-toc-parent-current, not a second
     aria-current, so assistive tech hears one current section. Only
     the strip is marked: the inline list is for jumping, not for
     "where am I".
   Without the script there is no mode, and the stylesheet shows the
   inline disclosure and hides the strip, so the list still works.
   An island like the rest (core/island.ts): mounting twice is a no-op,
   and destroy() drops every listener and the observer. */
import { claim, release, type Island, type IslandHandle } from "./core/island";
import { docOf } from "./core/dom";

export const TOC_STRIP_MIN_GUTTER = 220;

/* A hash is whatever the visitor typed or followed, and
   decodeURIComponent throws on a stray "%" ("#50%"). A throw at mount
   would also stop every island the layout mounts after this one, so a
   malformed hash falls back to its raw text. */
function decodeHash(hash: string): string {
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return hash.slice(1);
  }
}

export interface TocOptions {
  selector?: string;
  column?: string;
}

export const mountToc: Island<TocOptions> = (
  root,
  options = {},
): IslandHandle => {
  const { selector = "[data-toc]", column = ".shell" } = options;
  const doc = docOf(root);
  const toc = doc.querySelector<HTMLElement>(selector);
  const view = doc.defaultView;
  if (!toc || !view || !claim(toc, "toc")) return { destroy: () => undefined };

  const controller = new AbortController();
  const on = { signal: controller.signal };
  let observer: IntersectionObserver | null = null;
  let watcher: ResizeObserver | null = null;

  const handle: IslandHandle = {
    destroy(): void {
      controller.abort();
      observer?.disconnect();
      watcher?.disconnect();
      release(toc, "toc");
    },
  };

  const reference = toc.closest(column) ?? toc.parentElement;
  const strip = toc.querySelector<HTMLElement>("[data-toc-strip]");
  const inline = toc.querySelector<HTMLElement>("[data-toc-inline]");
  const panel = toc.querySelector<HTMLElement>(".toc-panel");

  /* Each id maps to its link, and each h3 link to its h2's link (the
     link in the closest li around the h3's own list). Ids are looked
     up with getElementById, never a selector, so a slug like
     "0.17-release" works; a link with no target on the page is
     skipped. Ids are unique per page, so one link per id: a second
     link to the same id replaces the first. */
  const links = new Map<string, HTMLAnchorElement>();
  const parents = new Map<HTMLAnchorElement, HTMLAnchorElement>();
  const targets: HTMLElement[] = [];

  toc
    .querySelectorAll<HTMLAnchorElement>("[data-toc-strip] a[href^='#']")
    .forEach((a) => {
      const id = decodeHash(a.hash);
      const target = id ? doc.getElementById(id) : null;
      if (!target) return;
      links.set(id, a);
      targets.push(target);

      const parent = a.closest("li")?.parentElement?.closest("li");
      const parentLink = parent?.querySelector<HTMLAnchorElement>(":scope > a");
      if (parentLink) parents.set(a, parentLink);
    });

  /* The column's content edge (its padding is page air, not gutter),
     and the component's offset inside it, read from whichever form is
     rendered: the hidden one has no box. */
  const measure = (): void => {
    const box = reference?.getBoundingClientRect();

    const pad = reference
      ? parseFloat(view.getComputedStyle(reference).paddingLeft) || 0
      : 0;

    const edge = Math.round((box?.left ?? 0) + pad);
    const mode = edge >= TOC_STRIP_MIN_GUTTER ? "strip" : "inline";
    toc.dataset.tocMode = mode;
    const shown = mode === "strip" ? strip : inline;
    const left = shown ? Math.round(shown.getBoundingClientRect().left) : edge;
    toc.style.setProperty("--toc-edge", `${String(edge)}px`);
    toc.style.setProperty("--toc-inset", `${String(left - edge)}px`);

    /* The strip anchor takes the panel's height (with an equal negative
       margin, so it takes no room in flow), so it stops sticking when
       the panel's bottom, not its top, meets the column's end and the
       list never hangs past the article into the footer. */
    if (mode === "strip" && panel) {
      const height = Math.round(panel.getBoundingClientRect().height);
      toc.style.setProperty("--toc-strip-height", `${String(height)}px`);
    }
  };

  measure();

  let frame = false;

  const remeasure = (): void => {
    if (frame) return;
    frame = true;

    view.requestAnimationFrame(() => {
      frame = false;
      if (!controller.signal.aborted) measure();
    });
  };

  view.addEventListener("resize", remeasure, on);

  /* The column can move with no window resize (a scrollbar arriving
     late, a consumer's layout toggle), and the panel's height follows
     its list. Writing the strip's height never resizes the panel, so
     this cannot loop. */
  if (typeof ResizeObserver === "function") {
    watcher = new ResizeObserver(remeasure);
    if (reference) watcher.observe(reference);
    if (panel) watcher.observe(panel);
  }

  if (targets.length === 0) return handle;

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

  const spy = new IntersectionObserver(
    (entries) => {
      if (Date.now() < quietUntil) return;
      const intersecting = entries.filter((entry) => entry.isIntersecting);
      const last = intersecting.at(-1);
      if (last) setCurrent(last.target.id);
    },
    { rootMargin: "-40% 0px -55% 0px" },
  );

  observer = spy;

  targets.forEach((target) => {
    spy.observe(target);
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
    const id = decodeHash(view.location.hash);
    if (!links.has(id)) return;
    quietUntil = Date.now() + 900;
    setCurrent(id);
  };

  view.addEventListener("hashchange", markHash, on);
  markHash();

  return handle;
};
