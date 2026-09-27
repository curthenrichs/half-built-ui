/* Pure placement shared by the measured islands (link-tip, popout;
   spec docs/superpowers/specs/2026-09-26-popout-design.md moved it
   here from link-tip.ts). Measure then place, never predict. */

const GAP = 1; /* px between anchor and tip; the old bottom: calc(100% + 1px) */
const INSET = 2; /* px of horizontal lead-out past the anchor edge */

export const EDGE = 12; /* px of breathing room against either viewport edge */

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
  const startX = anchor.left - INSET;
  const endX = anchor.right + INSET - tip.width;
  let x = align === "start" ? startX : endX;

  const overRight = x + tip.width - (viewport.width - edge);
  if (overRight > 0) x -= overRight;
  if (x < edge) x = edge;
  let finalPlace = place;

  if (place === "above" && anchor.top - GAP - tip.height < 0) {
    finalPlace = "below";
  }

  if (place === "below" && anchor.bottom + GAP + tip.height > viewport.height) {
    finalPlace = "above";
  }

  const y =
    finalPlace === "above"
      ? anchor.top - GAP - tip.height
      : anchor.bottom + GAP;

  return { x: Math.round(x), y: Math.round(y), place: finalPlace };
}
