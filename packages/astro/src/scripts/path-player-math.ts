/* Pure geometry for the path-player timeline; the canvas painter in
   path-player.ts consumes these, jsdom tests never need a 2D context. */

export function normalizeSeries(values: number[]): { min: number; max: number; frac: (v: number) => number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max, frac: (v) => (max > min ? (v - min) / (max - min) : 0.5) };
}

export function playheadX(t: number, duration: number, width: number): number {
  return (t / duration) * width;
}

export function formatReadout(t: number, duration: number): string {
  return `T+${t.toFixed(1).padStart(4, "0")} / ${duration.toFixed(1)}s`;
}

export function brightChannel(c: number): number {
  return Math.min(255, Math.round((c / 0.15) * 255));
}

/* Which sample a pixel column shows: the timeline maps the sample array
   across its width, so column px of width reads sample floor(px/width *
   length), clamped to the array. The same map serves time (t across
   duration) for the playhead's sample. */
export function columnIndex(px: number, width: number, length: number): number {
  return Math.max(0, Math.min(length - 1, Math.floor((px / width) * length)));
}

/* Vertical position of a normalized value inside a track: frac 0 sits
   pad above the track's bottom edge, frac 1 sits pad below its top. */
export function seriesY(frac: number, top: number, height: number, pad: number): number {
  return top + height - pad - frac * (height - 2 * pad);
}
