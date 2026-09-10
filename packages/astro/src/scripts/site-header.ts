import { claim, release, type Island, type IslandHandle } from "./core/island";
import { formatHeaderDate } from "../lib/header-date";
import { docOf } from "./core/dom";

/* The masthead header island (step 9): the date-box refresh, the
   phone menu toggle, and the search flyout, born from SiteHeader.astro's
   inline script. The halves are unconditional and independent,
   mirroring the original: the date box refreshes on every mount
   regardless of the menu (it is idempotent, same text each time), and
   each pop-out claims its own button so a second mount does not
   double-bind its click/pointerdown/keydown handlers.

   The search flyout joined the island on 2026-09-09 (owner report: the
   magnifier could open it but never close it, unlike the menu button).
   It had opened on :focus-within alone, which no button click can undo
   while the button holds the focus. The island marks the wrap
   data-search-js, the stylesheet hands the open state to a class, and
   the flyout becomes the same disclosure the menu is. */

export interface SiteHeaderOptions {
  dateId?: string;
  menuButton?: string;
  menuId?: string;
  searchButton?: string;
  searchWrap?: string;
  searchField?: string;
  /* Defaults to formatHeaderDate, the same function Base.astro uses for
     the server render. Its package-time home (staying in src/lib vs.
     moving into the library) is an 11.3 decision; this option just
     gives a second site a seam to override it without forking. */
  formatDate?: (d: Date) => string;
}

/* One pop-out over the page, the menu's manners (step 9): the button
   toggles, a press anywhere outside closes, Escape closes and hands
   focus back to the button. The open state is a class on `panel` and
   aria-expanded on the button. The flyout adds the two focus manners
   its :focus-within past had: the field takes focus on open, and
   keyboard focus leaving the panel closes it. A focusout with no
   destination is not a leave: Safari blurs the field before a click
   on the button lands, and closing there would make the button's own
   click reopen what it meant to close. */
interface Popout {
  btn: HTMLElement;
  panel: HTMLElement;
  openClass: string;
  onOpen?: () => void;
  closeOnFocusLeave?: boolean;
}

function wirePopout(doc: Document, { btn, panel, openClass, onOpen, closeOnFocusLeave = false }: Popout): () => void {
  const isOpen = (): boolean => panel.classList.contains(openClass);
  const inside = (t: EventTarget | null): boolean => t instanceof Node && (panel.contains(t) || btn.contains(t));
  const setOpen = (open: boolean): void => {
    panel.classList.toggle(openClass, open);
    btn.setAttribute("aria-expanded", String(open));
    if (open) onOpen?.();
  };
  const onClick = (): void => { setOpen(!isOpen()); };
  const onPointerdown = (ev: PointerEvent): void => {
    if (isOpen() && !inside(ev.target)) setOpen(false);
  };
  const onKeydown = (ev: KeyboardEvent): void => {
    if (ev.key !== "Escape" || !isOpen()) return;
    setOpen(false);
    btn.focus();
  };
  const onFocusout = (ev: FocusEvent): void => {
    if (isOpen() && ev.relatedTarget !== null && !inside(ev.relatedTarget)) setOpen(false);
  };
  btn.addEventListener("click", onClick);
  doc.addEventListener("pointerdown", onPointerdown);
  doc.addEventListener("keydown", onKeydown);
  if (closeOnFocusLeave) panel.addEventListener("focusout", onFocusout);
  return () => {
    btn.removeEventListener("click", onClick);
    doc.removeEventListener("pointerdown", onPointerdown);
    doc.removeEventListener("keydown", onKeydown);
    if (closeOnFocusLeave) panel.removeEventListener("focusout", onFocusout);
  };
}

export const mountSiteHeader: Island<SiteHeaderOptions> = (root, options = {}): IslandHandle => {
  const {
    dateId = "header-date",
    menuButton = ".menu-toggle",
    menuId = "primary-menu",
    searchButton = ".navigation-search-icon",
    searchWrap = ".navigation-search-wrap",
    searchField = ".search-field",
    formatDate = formatHeaderDate,
  } = options;
  const doc = docOf(root);

  // Header date: live like the WordPress original (build-time text is the
  // no-JS fallback), same format function as the server render.
  const dateBox = doc.getElementById(dateId);
  if (dateBox) dateBox.textContent = formatDate(new Date());

  const unwire: (() => void)[] = [];

  const btn = root.querySelector<HTMLButtonElement>(menuButton);
  const menu = doc.getElementById(menuId);
  if (btn && menu && claim(btn, "site-header")) {
    const off = wirePopout(doc, { btn, panel: menu, openClass: "open" });
    unwire.push(() => { off(); release(btn, "site-header"); });
  }

  const searchBtn = root.querySelector<HTMLButtonElement>(searchButton);
  const wrap = searchBtn?.closest<HTMLElement>(searchWrap) ?? null;
  if (searchBtn && wrap && claim(searchBtn, "site-header")) {
    const field = wrap.querySelector<HTMLInputElement>(searchField);
    wrap.setAttribute("data-search-js", "");
    const off = wirePopout(doc, {
      btn: searchBtn,
      panel: wrap,
      openClass: "search-open",
      onOpen: () => field?.focus(),
      closeOnFocusLeave: true,
    });
    unwire.push(() => {
      off();
      wrap.removeAttribute("data-search-js");
      release(searchBtn, "site-header");
    });
  }

  return {
    destroy(): void {
      for (const off of unwire) off();
    },
  };
};
