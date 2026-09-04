import { claim, release, type Island, type IslandHandle } from "./core/island";
import { formatHeaderDate } from "../lib/header-date";
import { docOf } from "./core/dom";

/* The masthead header island (step 9): the date-box refresh and the
   phone menu toggle, born from SiteHeader.astro's inline script.
   The two halves are unconditional and independent, mirroring the
   original: the date box refreshes on every mount regardless of the
   menu (it is idempotent, same text each time), and the menu wiring
   claims the button separately so a second mount does not double-bind
   its click/pointerdown/keydown handlers. */

export interface SiteHeaderOptions {
  dateId?: string;
  menuButton?: string;
  menuId?: string;
  /* Defaults to formatHeaderDate, the same function Base.astro uses for
     the server render. Its package-time home (staying in src/lib vs.
     moving into the library) is an 11.3 decision; this option just
     gives a second site a seam to override it without forking. */
  formatDate?: (d: Date) => string;
}

export const mountSiteHeader: Island<SiteHeaderOptions> = (root, options = {}): IslandHandle => {
  const { dateId = "header-date", menuButton = ".menu-toggle", menuId = "primary-menu", formatDate = formatHeaderDate } = options;
  const doc = docOf(root);

  // Header date: live like the WordPress original (build-time text is the
  // no-JS fallback), same format function as the server render.
  const dateBox = doc.getElementById(dateId);
  if (dateBox) dateBox.textContent = formatDate(new Date());

  const btn = root.querySelector<HTMLButtonElement>(menuButton);
  const menu = doc.getElementById(menuId);
  let onClick: (() => void) | null = null;
  let onPointerdown: ((ev: PointerEvent) => void) | null = null;
  let onKeydown: ((ev: KeyboardEvent) => void) | null = null;

  if (btn && claim(btn, "site-header")) {
    const isOpen = (): boolean => menu?.classList.contains("open") ?? false;
    const setOpen = (open: boolean): void => {
      menu?.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    };
    onClick = () => { setOpen(!isOpen()); };
    btn.addEventListener("click", onClick);
    /* A pop-out over the page closes the way the search flyout does: a
       press anywhere outside it, or Escape (which hands focus back to the
       button). */
    onPointerdown = (ev) => {
      if (!isOpen()) return;
      const t = ev.target;
      if (t instanceof Node && (menu?.contains(t) || btn.contains(t))) return;
      setOpen(false);
    };
    onKeydown = (ev) => {
      if (ev.key !== "Escape" || !isOpen()) return;
      setOpen(false);
      btn.focus();
    };
    doc.addEventListener("pointerdown", onPointerdown);
    doc.addEventListener("keydown", onKeydown);
  }

  return {
    destroy(): void {
      if (btn && onClick) btn.removeEventListener("click", onClick);
      if (onPointerdown) doc.removeEventListener("pointerdown", onPointerdown);
      if (onKeydown) doc.removeEventListener("keydown", onKeydown);
      if (btn && onClick) release(btn, "site-header");
    },
  };
};
