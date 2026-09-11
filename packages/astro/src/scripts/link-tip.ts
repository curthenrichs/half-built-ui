import { claim, release, type Island, type IslandHandle } from "./core/island";
import { docOf } from "./core/dom";

const GAP = 1; /* px between anchor and tip; the old bottom: calc(100% + 1px) */
const INSET = 2; /* px of horizontal lead-out past the anchor edge */
const EDGE = 12; /* px of breathing room against either viewport edge */

export type TipPlace = "above" | "below";
export type TipAlign = "start" | "end";
export interface AnchorRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export interface TipSize {
  width: number;
  height: number;
}
export interface ViewportSize {
  width: number;
  height: number;
}
export interface TipPosition {
  x: number;
  y: number;
  place: TipPlace;
}

/* Pure placement for the singleton tip: start/end alignment against
   the anchor, horizontal clamp into [edge, vw - edge] with the left
   edge winning when both bind, and a vertical flip when the preferred
   side would leave the viewport. All measured values; no prediction. */
export function placeTip(
  anchor: AnchorRect,
  tip: TipSize,
  viewport: ViewportSize,
  place: TipPlace = "above",
  align: TipAlign = "start",
  edge: number = EDGE,
): TipPosition {
  let x =
    align === "start" ? anchor.left - INSET : anchor.right + INSET - tip.width;

  const overRight = x + tip.width - (viewport.width - edge);
  if (overRight > 0) x -= overRight;
  if (x < edge) x = edge;
  let finalPlace = place;
  if (place === "above" && anchor.top - GAP - tip.height < 0)
    finalPlace = "below";
  if (place === "below" && anchor.bottom + GAP + tip.height > viewport.height)
    finalPlace = "above";

  const y =
    finalPlace === "above"
      ? anchor.top - GAP - tip.height
      : anchor.bottom + GAP;

  return { x: Math.round(x), y: Math.round(y), place: finalPlace };
}

export interface LinkTipOptions {
  selector?: string;
  edge?: number;
}

/* One island, one real tooltip element. On hover/focus of a matching
   link the singleton is filled (data-tooltip if stamped, else the
   href), measured with getBoundingClientRect, and placed fixed via
   placeTip: measure then place, never predict, which is the whole
   point (spec 2026-09-02; three positioning defects shipped from
   pseudo-element prediction). Containers steer placement with
   data-tip-place="below" and data-tip-align="end" (the masthead). */
export const mountLinkTips: Island<LinkTipOptions> = (
  root,
  options = {},
): IslandHandle => {
  const { selector = 'a[href^="http"], a[data-tooltip]', edge = EDGE } =
    options;

  const doc = docOf(root);

  if (!claim(doc.documentElement, "link-tip")) {
    return {
      destroy(): void {
        /* already claimed elsewhere: nothing here to tear down */
        return;
      },
    };
  }

  const win = doc.defaultView;
  /* Touch: claims (so double mounts stay no-ops) but attaches nothing;
     mobile browsers already show the URL themselves. jsdom has no
     matchMedia at all (same widened-type guard as henry-loose.ts and
     path-player.ts): the plain Window type always declares the method,
     so an unwidened optional chain reads as always-true to the lint. */
  const mmWin = win as { matchMedia?: typeof window.matchMedia } | null;

  if (mmWin?.matchMedia?.("(hover: none)").matches) {
    return {
      destroy(): void {
        release(doc.documentElement, "link-tip");
      },
    };
  }

  const tip = doc.createElement("div");
  tip.className = "link-tip";
  /* Presentation only: it duplicates the href or title assistive tech
     already reads from the link itself. */
  tip.setAttribute("aria-hidden", "true");
  tip.hidden = true;
  doc.body.append(tip);

  const hide = (): void => {
    tip.hidden = true;
    tip.classList.remove("is-open");
  };

  const linkFor = (t: EventTarget | null): HTMLElement | null => {
    if (!(t instanceof Element)) return null;
    const a = t.closest(selector);
    return a instanceof HTMLElement ? a : null;
  };

  const show = (a: HTMLElement): void => {
    const text = a.getAttribute("data-tooltip") ?? a.getAttribute("href") ?? "";
    if (!text) return;
    tip.textContent = text;
    tip.classList.remove("is-open");
    tip.hidden = false;
    /* Wrapped links anchor at the first fragment (owner decision
       2026-09-02); jsdom returns no fragments, hence the fallback. */
    const rects = a.getClientRects();
    const anchor = rects.length > 0 ? rects[0] : a.getBoundingClientRect();
    /* This measurement also flushes layout, so the .is-open add below
       lands a frame after un-hiding and the opacity fade plays. */
    const box = tip.getBoundingClientRect();
    const place = a.closest('[data-tip-place="below"]') ? "below" : "above";
    const align = a.closest('[data-tip-align="end"]') ? "end" : "start";

    const viewport = {
      width: doc.documentElement.clientWidth,
      height: doc.documentElement.clientHeight,
    };

    const pos = placeTip(anchor, box, viewport, place, align, edge);
    tip.style.left = `${String(pos.x)}px`;
    tip.style.top = `${String(pos.y)}px`;
    tip.classList.add("is-open");
  };

  const onOver = (ev: Event): void => {
    const a = linkFor(ev.target);
    if (a) show(a);
  };

  const onOut = (ev: Event): void => {
    if (linkFor(ev.target)) hide();
  };

  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key === "Escape") hide();
  };

  const onHide = (): void => {
    hide();
  };

  doc.addEventListener("mouseover", onOver);
  doc.addEventListener("focusin", onOver);
  doc.addEventListener("mouseout", onOut);
  doc.addEventListener("focusout", onOut);
  /* capture: scroll does not bubble from inner scrollers */
  doc.addEventListener("scroll", onHide, true);
  win?.addEventListener("resize", onHide);
  doc.addEventListener("keydown", onKey);

  return {
    destroy(): void {
      doc.removeEventListener("mouseover", onOver);
      doc.removeEventListener("focusin", onOver);
      doc.removeEventListener("mouseout", onOut);
      doc.removeEventListener("focusout", onOut);
      doc.removeEventListener("scroll", onHide, true);
      win?.removeEventListener("resize", onHide);
      doc.removeEventListener("keydown", onKey);
      tip.remove();
      release(doc.documentElement, "link-tip");
    },
  };
};
