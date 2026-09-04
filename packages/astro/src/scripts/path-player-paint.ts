/* Canvas painters for the path-player timeline; each takes a Painter
   and paints one thing at a given top. Pure over the context they are
   handed, so tests drive them with a recording context (test/helpers.ts)
   and never need a real canvas. The transport in path-player.ts composes
   them once per layout onto an offscreen canvas. */
import { normalizeSeries, brightChannel, columnIndex, seriesY } from "./path-player-math";
import type { BandTrack, LinesTrack } from "./path-player";

export const AXIS_STEP_S = 2;
/* Theme-less defaults for the timeline's paper, ink, and rule, used when
   a Painter carries none (the pure painter tests). The transport passes
   the theme's --well, --ink, and --rule so the tracks follow day and
   night like the rest of the plate (owner call 2026-08-26). */
export const PAPER = "#ffffff";
export const INK = "#111111";
export const ink = (alpha: number): string => `rgba(17, 17, 17, ${alpha})`;

/* Everything the static painters share: the context, the plate width,
   the time-to-x map, a CSS custom property reader for series colors,
   and the theme's paper, ink, and rule. */
export interface Painter {
  ctx: CanvasRenderingContext2D;
  width: number;
  xAt: (t: number) => number;
  cssColor: (v: string) => string;
  paper?: string;
  ink?: string;
  rule?: string;
}

const paperOf = (p: Painter): string => p.paper ?? PAPER;
const ruleOf = (p: Painter): string => p.rule ?? INK;

/* The ink at an alpha. Custom properties resolve to hex, which the
   canvas cannot take with an alpha, so the hex is split here; any
   other form falls back to the fixed ink. */
export function inkOf(p: Painter, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(p.ink ?? "");
  if (!m) return ink(alpha);
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/* The 2px rule every track wears, inside its own edge, so a band and a
   lines track sit in the same frame the window does. */
function frameTrack(p: Painter, top: number, height: number): void {
  p.ctx.strokeStyle = ruleOf(p);
  p.ctx.lineWidth = 2;
  p.ctx.strokeRect(1, top + 1, p.width - 2, height - 2);
}

/* Polyline of a series across the track, one point per pixel column,
   held inside the track by pad on both edges. */
export function strokeSeries(p: Painter, values: number[], top: number, height: number, pad: number, style: string): void {
  const n = normalizeSeries(values);
  p.ctx.beginPath();
  for (let px = 0; px < p.width; px++) {
    const y = seriesY(n.frac(values[columnIndex(px, p.width, values.length)]), top, height, pad);
    if (px === 0) p.ctx.moveTo(px, y); else p.ctx.lineTo(px, y);
  }
  p.ctx.strokeStyle = style;
  p.ctx.lineWidth = 1.5;
  p.ctx.stroke();
}

/* A band track is a color strip, one sample per column, with the
   envelope drawn over it in white. */
export function paintBand(p: Painter, track: BandTrack, top: number, sampleCount: number): void {
  for (let px = 0; px < p.width; px++) {
    const c = track.colorAt(columnIndex(px, p.width, sampleCount));
    p.ctx.fillStyle = `rgb(${brightChannel(c.r)}, ${brightChannel(c.g)}, ${brightChannel(c.b)})`;
    p.ctx.fillRect(px, top, 1.5, track.height);
  }
  const env = Array.from({ length: sampleCount }, (_, i) => track.envelopeAt(i));
  strokeSeries(p, env, top, track.height, 3, "rgba(255, 255, 255, 0.9)");
  frameTrack(p, top, track.height);
}

/* A lines track is a paper panel: shaded regions, labeled ticks, one
   polyline per series in its CSS color, series labels stacked at the
   right edge. */
export function paintLines(p: Painter, track: LinesTrack, top: number): void {
  const { ctx, width, xAt } = p;
  ctx.fillStyle = paperOf(p);
  ctx.fillRect(0, top, width, track.height);
  ctx.fillStyle = inkOf(p, 0.07);
  for (const r of track.regions) {
    ctx.fillRect(xAt(r.t0), top, xAt(r.t1) - xAt(r.t0), track.height);
  }
  ctx.strokeStyle = inkOf(p, 0.35);
  ctx.fillStyle = inkOf(p, 0.55);
  ctx.lineWidth = 1;
  ctx.font = "8px sans-serif";
  ctx.textAlign = "center";
  for (const tick of track.ticks) {
    ctx.beginPath();
    ctx.moveTo(xAt(tick.t), top);
    ctx.lineTo(xAt(tick.t), top + track.height);
    ctx.stroke();
    ctx.fillText(tick.label, xAt(tick.t), top + 8);
  }
  for (const s of track.series) {
    strokeSeries(p, s.values, top, track.height, 5, p.cssColor(s.cssVar));
  }
  /* Series labels in series order, left to right, ending at the right
     edge (X Y Z, owner call 2026-08-26; stacking from the edge read
     backwards). */
  ctx.font = "bold 9px sans-serif";
  ctx.textAlign = "right";
  const last = track.series.length - 1;
  track.series.forEach((s, i) => {
    ctx.fillStyle = p.cssColor(s.cssVar);
    ctx.fillText(s.label.toUpperCase(), width - 4 - (last - i) * 14, top + track.height - 4);
  });
  frameTrack(p, top, track.height);
}

/* The chip names the track the way the caption does (FEED, PATH);
   white ground so it reads over the band colors too. */
export function paintLabelChip(p: Painter, label: string, top: number): void {
  const { ctx } = p;
  ctx.font = "bold 9px sans-serif";
  ctx.textAlign = "left";
  const labelW = ctx.measureText(label).width;
  ctx.fillStyle = paperOf(p);
  ctx.fillRect(2, top + 2, labelW + 8, 12);
  ctx.strokeStyle = inkOf(p, 0.35);
  ctx.lineWidth = 1;
  ctx.strokeRect(2.5, top + 2.5, labelW + 7, 11);
  ctx.fillStyle = inkOf(p, 0.8);
  ctx.fillText(label, 6, top + 11);
}

/* Time axis under the last track: a tick and "Ns" label every
   AXIS_STEP_S seconds. A label that would run off the canvas is
   dropped; its tick stays (phone report 2026-08-27: the demo's "18s"
   clipped to "18" on narrow plates, and flipping it left of the tick
   crowded the neighbor, so the owner chose the empty end). */
export function paintAxis(p: Painter, top: number, duration: number): void {
  const { ctx, xAt, width } = p;
  ctx.fillStyle = inkOf(p, 0.5);
  ctx.strokeStyle = inkOf(p, 0.3);
  ctx.font = "8px sans-serif";
  ctx.textAlign = "left";
  for (let t = 0; t < duration; t += AXIS_STEP_S) {
    const x = xAt(t);
    ctx.beginPath();
    ctx.moveTo(x, top + 2);
    ctx.lineTo(x, top + 6);
    ctx.stroke();
    const label = `${t}s`;
    if (x + 2 + ctx.measureText(label).width <= width) ctx.fillText(label, x + 2, top + 11);
  }
}
