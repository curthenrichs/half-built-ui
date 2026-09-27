/* Popout (spec docs/superpowers/specs/2026-09-26-popout-design.md):
   secondary context for tables and data viz. One island, one real
   <dialog> per page. A click on a trigger fills it from the template
   right after that trigger and opens it anchored below the trigger
   (desktop) or as a modal bottom sheet (phone width, decided at each
   open). Chrome lives in @half-built/css popout.css.

   A document-wide singleton, like link-tip: root only names the
   document; triggers anywhere in it open the one surface. */

import { claim, release, type Island, type IslandHandle } from "./core/island";
import { docOf, el, iconButton } from "./core/dom";
import { ICON_X } from "./core/icons";
import { BP_PHONE_MAX } from "./core/breakpoints";
import {
  placeTip,
  EDGE,
  type AnchorRect,
  type ViewportSize,
} from "./core/placement";

export type PopoutMode = "anchored" | "sheet";

/* The tip edge plus the close box's 17px straddle, so the box never
   lands with its close control off screen. */
const POPOUT_EDGE = EDGE + 18;

/* The label straddles the box's top rule by about 12px; this keeps it
   off the trigger it belongs to. */
const LABEL_CLEAR = 16;

export const SWIPE_CLOSE = 60;

export interface PopoutOptions {
  selector?: string;
  edge?: number;
  closeLabel?: string;
}

interface MediaHost {
  matchMedia?: (q: string) => { matches: boolean };
}

/* Widened like link-tip's guard: jsdom has no matchMedia, and the plain
   Window type always declares it. */
export function popoutMode(win: MediaHost | null): PopoutMode {
  return win?.matchMedia?.(`(max-width: ${BP_PHONE_MAX}px)`).matches
    ? "sheet"
    : "anchored";
}

export function offscreen(r: AnchorRect, vp: ViewportSize): boolean {
  return (
    r.bottom < 0 || r.top >= vp.height || r.right < 0 || r.left >= vp.width
  );
}

export function isSwipeClose(
  startY: number | null,
  endY: number,
  threshold: number = SWIPE_CLOSE,
): boolean {
  return startY !== null && endY - startY >= threshold;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The first element after anchor, in document order, that sequential
    focus navigation would reach, ignoring anything inside skip. */
export function nextFocusableAfter(
  doc: Document,
  anchor: Element,
  skip: Element,
): HTMLElement | null {
  for (const node of doc.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (skip.contains(node) || anchor.contains(node)) continue;
    if (node.getAttribute("tabindex") === "-1") continue;
    if (node.closest("[hidden], [inert]")) continue;

    const after =
      anchor.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING;

    if (after) return node;
  }

  return null;
}

export const mountPopouts: Island<PopoutOptions> = (
  root,
  options = {},
): IslandHandle => {
  const {
    selector = ".popout-trigger",
    edge = POPOUT_EDGE,
    closeLabel = "Close",
  } = options;

  const doc = docOf(root);
  const html = doc.documentElement;

  if (!claim(html, "popout")) {
    return {
      destroy(): void {
        /* already claimed elsewhere: nothing here to tear down */
        return;
      },
    };
  }

  const win = doc.defaultView;
  const media = win as MediaHost | null;

  const surface = el(doc, "dialog", "popout");
  surface.setAttribute("aria-labelledby", "popout-label");
  surface.setAttribute("aria-describedby", "popout-body");
  surface.tabIndex = -1;
  const label = el(doc, "span", "popout-label boxed-label micro-label");
  label.id = "popout-label";
  const closeBtn = iconButton(doc, "popout-close icon-box", closeLabel, ICON_X);
  const body = el(doc, "div", "popout-body");
  body.id = "popout-body";
  surface.append(label, closeBtn, body);
  doc.body.append(surface);

  let current: HTMLElement | null = null;
  let mode: PopoutMode = "anchored";
  let frame = 0;
  let swipeStart: number | null = null;
  /* A press is under way between pointerdown and its click (or the
     next key). Focus moves during it, sometimes to nothing (Safari does
     not focus a pressed button); the pointer handlers own that close. */
  let pressing = false;
  /* Sheet only: whether the pointerdown that started the current press
     landed on the dialog element itself (the backdrop), so a press that
     starts inside and is dragged onto the backdrop before release does
     not read as a backdrop click. */
  let pressOnSurface = false;

  const viewport = (): ViewportSize => ({
    width: html.clientWidth,
    height: html.clientHeight,
  });

  const triggerFor = (t: EventTarget | null): HTMLElement | null => {
    if (!(t instanceof Element)) return null;
    const hit = t.closest(selector);
    return hit instanceof HTMLElement ? hit : null;
  };

  /* Every way out lands here, synchronously. dialog.close() queues its
     close event in real browsers, so the listener below only acts when
     the dialog is actually shut: a late event after a reopen is
     ignored.

     A close the reader asked for (the close box, Escape, the open
     trigger, the backdrop, a swipe) hands focus back to the trigger.
     An automatic one (scroll-away, a breakpoint crossing, focus
     leaving, a press outside) does not: the trigger may be off screen,
     and a focused one reopens on Space against an anchor nobody can
     see. Focus inside the box is dropped before close(), which would
     otherwise restore it to the trigger itself (the dialog's own
     previously-focused-element step; always so for the modal sheet,
     hence the second check after). */
  const finish = (restoreFocus = true): void => {
    const opener = current;
    if (!opener) return;
    current = null;

    if (frame) {
      win?.cancelAnimationFrame(frame);
      frame = 0;
    }

    const active = doc.activeElement;

    if (
      !restoreFocus &&
      active instanceof HTMLElement &&
      surface.contains(active)
    ) {
      active.blur();
    }

    if (surface.open) surface.close();
    surface.classList.remove("is-anchored", "is-sheet");
    surface.style.left = "";
    surface.style.top = "";
    body.replaceChildren();
    html.classList.remove("popout-open");
    opener.setAttribute("aria-expanded", "false");
    opener.classList.remove("is-open");

    if (restoreFocus) opener.focus({ preventScroll: true });
    else if (doc.activeElement === opener && active !== opener) opener.blur();
  };

  const place = (): void => {
    if (!current) return;
    const r = current.getBoundingClientRect();

    const anchor: AnchorRect = {
      left: r.left,
      right: r.right,
      top: r.top - LABEL_CLEAR,
      bottom: r.bottom + LABEL_CLEAR,
    };

    const pos = placeTip(
      anchor,
      surface.getBoundingClientRect(),
      viewport(),
      "below",
      "start",
      edge,
    );

    surface.style.left = `${pos.x}px`;
    surface.style.top = `${pos.y}px`;
  };

  const open = (trigger: HTMLElement): void => {
    const tpl = trigger.nextElementSibling;
    if (!(tpl instanceof HTMLTemplateElement)) return;
    finish(false);
    current = trigger;
    mode = popoutMode(media);
    label.textContent = trigger.dataset.popoutLabel ?? "";
    body.replaceChildren(tpl.content.cloneNode(true));
    trigger.setAttribute("aria-expanded", "true");
    trigger.classList.add("is-open");

    if (mode === "sheet") {
      surface.classList.add("is-sheet");
      surface.showModal();
      html.classList.add("popout-open");
    } else {
      surface.classList.add("is-anchored");
      surface.show();
      place();
    }

    surface.focus({ preventScroll: true });
  };

  const onClick = (ev: MouseEvent): void => {
    pressing = false;
    const trigger = triggerFor(ev.target);

    if (trigger) {
      if (trigger === current) finish();
      else open(trigger);
      return;
    }

    /* The dialog has no padding of its own (popout.css), so a click on
       the element itself is a click on the sheet's backdrop, but only
       when the press that produced this click also started there: a
       press dragged from inside the sheet onto the backdrop must not
       close it. */
    if (ev.target === surface && mode === "sheet" && pressOnSurface) finish();
    pressOnSurface = false;
  };

  /* Anchored only; the sheet's outside is its backdrop. A press on any
     trigger is left to the click handler, or pressing the open trigger
     would close here and reopen on click. */
  const onPointerDown = (ev: Event): void => {
    pressOnSurface = ev.target === surface;
    pressing = true;
    if (!current || mode !== "anchored") return;
    const t = ev.target;
    if (t instanceof Node && surface.contains(t)) return;
    if (triggerFor(t)) return;
    finish(false);
  };

  /* A touch pan ends in pointercancel, never a click; the press is over,
     so the flag must not outlive it, or a later null-relatedTarget
     focusout is ignored forever and the box sticks open. pointerup is
     deliberately not one of these: a real tap can put pointerup, a focus
     change, and the click in separate tasks, and clearing the flag at
     pointerup lets the focus change's queued close beat the click, which
     then reopens what the tap meant to close. A press dragged off its
     target and released elsewhere is left holding the flag until the
     next click, keydown, or pointerdown; that fails safe, leaving the
     box open rather than closing and reopening it. */
  const onPointerCancel = (): void => {
    pressing = false;
  };

  const inside = (t: EventTarget | null): boolean =>
    t instanceof Node &&
    (surface.contains(t) || (current?.contains(t) ?? false));

  /* Anchored only: the sheet is modal and keeps focus itself. Keyboard
     focus leaving the box and its trigger closes it (the site-header
     flyout's manner). With no destination, focus went to browser chrome
     or another window, or a press is moving it; the check waits for the
     move to settle, leaves a press to the pointer handlers, and keeps
     the box open when focus is still inside it (a window switch leaves
     the document's focus where it was). */
  const onFocusOut = (ev: FocusEvent): void => {
    if (!current || mode !== "anchored") return;

    if (ev.relatedTarget !== null) {
      if (!inside(ev.relatedTarget)) finish(false);
      return;
    }

    if (pressing) return;

    queueMicrotask(() => {
      if (current && mode === "anchored" && !inside(doc.activeElement)) {
        finish(false);
      }
    });
  };

  const onKey = (ev: KeyboardEvent): void => {
    pressing = false;
    if (ev.key !== "Escape" || !current) return;
    ev.preventDefault();
    finish();
  };

  /* Anchored only: the box sits last in <body>, so native Tab order
     would carry focus to the footer or out of the page. Shift+Tab off
     the first stop goes back to the trigger; Tab off the last stop
     goes to whatever follows the trigger. */
  const onSurfaceKey = (ev: KeyboardEvent): void => {
    if (ev.key !== "Tab" || !current || mode !== "anchored") return;
    const stops = [...surface.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = stops.at(0);
    const last = stops.at(-1);
    const active = doc.activeElement;

    if (ev.shiftKey && (active === surface || active === first)) {
      ev.preventDefault();
      finish();
      return;
    }

    if (!ev.shiftKey && (active === last || stops.length === 0)) {
      ev.preventDefault();
      const trigger = current;
      finish(false);

      /* A candidate that matches FOCUSABLE can still silently refuse
         focus: display:none or visibility:hidden by CSS, inside a
         closed <details>, or inside a disabled <fieldset> all pass the
         selector but leave .focus() a no-op. Walk forward from each
         failed candidate (nextFocusableAfter takes it as the new
         anchor) until one actually takes focus, and fall back to the
         trigger when none does. */
      let anchor: HTMLElement = trigger;
      let candidate = nextFocusableAfter(doc, anchor, surface);

      while (candidate) {
        candidate.focus();
        if (doc.activeElement === candidate) return;
        anchor = candidate;
        candidate = nextFocusableAfter(doc, anchor, surface);
      }

      trigger.focus();
    }
  };

  /* Anchored only: focus leaving the trigger itself for somewhere
     outside both the trigger and the box closes it. Once open, focus
     starts on the surface itself, so under normal tabbing this trigger
     never holds focus while the box is open. This handler is a guard
     for the case where focus reaches the trigger anyway while the box
     is still open (a script, or assistive tech moving focus directly)
     and then leaves for the rest of the page. */
  const onTriggerFocusOut = (ev: FocusEvent): void => {
    if (!current || mode !== "anchored" || ev.target !== current) return;
    if (ev.relatedTarget === null || inside(ev.relatedTarget)) return;
    finish(false);
  };

  const settle = (): void => {
    frame = 0;
    if (!current) return;

    if (offscreen(current.getBoundingClientRect(), viewport())) {
      finish(false);
      return;
    }

    place();
  };

  const onScroll = (): void => {
    if (!current || mode !== "anchored" || frame) return;
    frame = win?.requestAnimationFrame(settle) ?? 0;
  };

  const onResize = (): void => {
    if (!current) return;

    if (popoutMode(media) !== mode) {
      finish(false);
      return;
    }

    if (mode === "anchored") place();
  };

  const onClose = (): void => {
    if (!surface.open) finish();
  };

  const onTouchStart = (ev: TouchEvent): void => {
    swipeStart =
      mode === "sheet" && body.scrollTop === 0
        ? (ev.touches.item(0)?.clientY ?? null)
        : null;
  };

  const onTouchEnd = (ev: TouchEvent): void => {
    const y = ev.changedTouches.item(0)?.clientY;
    if (y !== undefined && isSwipeClose(swipeStart, y)) finish();
    swipeStart = null;
  };

  const onCloseBtn = (): void => {
    finish();
  };

  doc.addEventListener("click", onClick);
  doc.addEventListener("pointerdown", onPointerDown);
  doc.addEventListener("pointercancel", onPointerCancel);
  doc.addEventListener("keydown", onKey);
  doc.addEventListener("focusout", onTriggerFocusOut);
  /* capture: scroll does not bubble from inner scrollers (.table-scroll) */
  doc.addEventListener("scroll", onScroll, true);
  win?.addEventListener("resize", onResize);
  surface.addEventListener("close", onClose);
  surface.addEventListener("focusout", onFocusOut);
  surface.addEventListener("keydown", onSurfaceKey);
  surface.addEventListener("touchstart", onTouchStart, { passive: true });
  surface.addEventListener("touchend", onTouchEnd, { passive: true });
  closeBtn.addEventListener("click", onCloseBtn);

  return {
    destroy(): void {
      finish(false);
      doc.removeEventListener("click", onClick);
      doc.removeEventListener("pointerdown", onPointerDown);
      doc.removeEventListener("pointercancel", onPointerCancel);
      doc.removeEventListener("keydown", onKey);
      doc.removeEventListener("focusout", onTriggerFocusOut);
      doc.removeEventListener("scroll", onScroll, true);
      win?.removeEventListener("resize", onResize);
      surface.remove();
      release(html, "popout");
    },
  };
};
