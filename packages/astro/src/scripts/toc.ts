/* The page TOC island, grown from the demo site's rail TOC.
   Toc.astro renders one of two forms where the consumer places it:
   the panel (form="panel", [data-toc]), an open boxed list that sits in
   a rail or column, and the inline disclosure (form="inline"), a
   <details> in normal flow. Which form shows at which width is the
   consumer's CSS; nothing here measures the page.
   This script tracks the reader in the panel: one IntersectionObserver
   over the elements its links name, marking the current link with
   aria-current. Inside an h3, the h2 above it gets
   data-toc-parent-current, not a second aria-current, so assistive
   tech hears one current section. The inline form is for jumping, not
   for "where am I", and needs no script, so a page with only that form
   mounts nothing. Without the script the panel still shows; it just
   marks nothing.
   An island like the rest (core/island.ts): mounting twice is a no-op,
   and destroy() drops every listener and the observer. */
import { claim, release, type Island, type IslandHandle } from "./core/island";
import { docOf } from "./core/dom";

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
}

export const mountToc: Island<TocOptions> = (
  root,
  options = {},
): IslandHandle => {
  const { selector = "[data-toc]" } = options;
  const doc = docOf(root);
  const toc = doc.querySelector<HTMLElement>(selector);
  const view = doc.defaultView;
  if (!toc || !view || !claim(toc, "toc")) return { destroy: () => undefined };

  const controller = new AbortController();
  const on = { signal: controller.signal };
  let observer: IntersectionObserver | null = null;

  const handle: IslandHandle = {
    destroy(): void {
      controller.abort();
      observer?.disconnect();
      release(toc, "toc");
    },
  };

  /* Each id maps to its link, and each h3 link to its h2's link (the
     link in the closest li around the h3's own list). Ids are looked
     up with getElementById, never a selector, so a slug like
     "0.17-release" works; a link with no target on the page is
     skipped. Ids are unique per page, so one link per id: a second
     link to the same id replaces the first. */
  const links = new Map<string, HTMLAnchorElement>();
  const parents = new Map<HTMLAnchorElement, HTMLAnchorElement>();
  const targets: HTMLElement[] = [];

  toc.querySelectorAll<HTMLAnchorElement>("a[href^='#']").forEach((a) => {
    const id = decodeHash(a.hash);
    const target = id ? doc.getElementById(id) : null;
    if (!target) return;
    links.set(id, a);
    targets.push(target);

    const parent = a.closest("li")?.parentElement?.closest("li");
    const parentLink = parent?.querySelector<HTMLAnchorElement>(":scope > a");
    if (parentLink) parents.set(a, parentLink);
  });

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
