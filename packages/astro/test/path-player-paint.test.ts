/* Painting geometry for the path player, asserted against a recording
   context (no canvas, node env). The expectations lean on columnIndex,
   seriesY, playheadX, and brightChannel from path-player-math so what
   is pinned is that the painters use the shared geometry, not a second
   derivation of it. */
import { describe, it, expect } from "vitest";
import {
  strokeSeries,
  paintBand,
  paintLines,
  paintLabelChip,
  paintAxis,
  PAPER,
  INK,
  ink,
  type Painter,
} from "../src/scripts/path-player-paint";
import {
  columnIndex,
  seriesY,
  playheadX,
  brightChannel,
} from "../src/scripts/path-player-math";
import { recordingContext, type RecordingContext } from "./helpers";

const WIDTH = 100;
const DURATION = 5;

function painter(): { p: Painter; rec: RecordingContext } {
  const rec = recordingContext();

  const p: Painter = {
    ctx: rec.ctx,
    width: WIDTH,
    xAt: (t) => playheadX(t, DURATION, WIDTH),
    cssColor: (v) => (v === "--track-x" ? "#ff0000" : INK),
  };

  return { p, rec };
}

describe("strokeSeries", () => {
  it("one moveTo then a lineTo per remaining column, held inside the pad", () => {
    const { p, rec } = painter();
    /* Two samples: columns 0..49 read the minimum, 50..99 the maximum. */
    strokeSeries(p, [0, 10], 20, 40, 5, "#abcdef");
    const moves = rec.ops("moveTo");
    const lines = rec.ops("lineTo");
    expect(moves).toHaveLength(1);
    expect(lines).toHaveLength(WIDTH - 1);
    expect(moves[0].args).toEqual([0, seriesY(0, 20, 40, 5)]);

    expect(lines[lines.length - 1].args).toEqual([
      WIDTH - 1,
      seriesY(1, 20, 40, 5),
    ]);

    for (const c of lines) {
      const y = c.args[1] as number;
      expect(y).toBeGreaterThanOrEqual(20 + 5);
      expect(y).toBeLessThanOrEqual(20 + 40 - 5);
    }

    const stroke = rec.ops("stroke");
    expect(stroke).toHaveLength(1);
    expect(stroke[0].strokeStyle).toBe("#abcdef");
    expect(stroke[0].lineWidth).toBe(1.5);
  });
});

describe("paintBand", () => {
  const colors = [
    { r: 0, g: 0, b: 0 },
    { r: 0.15, g: 0.075, b: 0 },
    { r: 0.05, g: 0.05, b: 0.05 },
  ];

  const track = {
    kind: "band" as const,
    height: 30,
    colorAt: (i: number) => colors[i],
    envelopeAt: (i: number) => [1, 3, 2][i],
  };

  it("one column per pixel, colored from the sample that column reads", () => {
    const { p, rec } = painter();
    paintBand(p, track, 10, colors.length);
    const rects = rec.ops("fillRect");
    expect(rects).toHaveLength(WIDTH);

    rects.forEach((c, px) => {
      const s = colors[columnIndex(px, WIDTH, colors.length)];
      expect(c.args).toEqual([px, 10, 1.5, 30]);

      expect(c.fillStyle).toBe(
        `rgb(${brightChannel(s.r)}, ${brightChannel(s.g)}, ${brightChannel(s.b)})`,
      );
    });
  });

  it("draws the envelope over the strip in white", () => {
    const { p, rec } = painter();
    paintBand(p, track, 10, colors.length);
    const strokes = rec.ops("stroke");
    expect(strokes).toHaveLength(1);
    expect(strokes[0].strokeStyle).toBe("rgba(255, 255, 255, 0.9)");
    expect(rec.ops("moveTo")[0].args[1]).toBe(seriesY(0, 10, 30, 3)); // column 0 reads envelope 1, the minimum
  });
});

describe("paintLines", () => {
  const track = {
    kind: "lines" as const,
    height: 60,
    series: [
      { label: "x", values: [0, 1, 2], cssVar: "--track-x" },
      { label: "y", values: [2, 1, 0], cssVar: "--track-y" },
    ],
    regions: [{ t0: 1, t1: 2.5 }],
    ticks: [
      { t: 2, label: "2" },
      { t: 4, label: "3" },
    ],
  };

  it("paper panel first, then a shaded rect per region", () => {
    const { p, rec } = painter();
    paintLines(p, track, 20);
    const rects = rec.ops("fillRect");
    expect(rects[0].args).toEqual([0, 20, WIDTH, 60]);
    expect(rects[0].fillStyle).toBe(PAPER);
    expect(rects).toHaveLength(1 + track.regions.length);
    const x0 = playheadX(1, DURATION, WIDTH);
    const x1 = playheadX(2.5, DURATION, WIDTH);
    expect(rects[1].args).toEqual([x0, 20, x1 - x0, 60]);
    expect(rects[1].fillStyle).toBe(ink(0.07));
  });

  it("a full-height rule and a label per tick", () => {
    const { p, rec } = painter();
    paintLines(p, track, 20);
    const tickStrokes = rec.ops("stroke").filter((c) => c.lineWidth === 1);
    expect(tickStrokes).toHaveLength(track.ticks.length);
    const labels = rec.ops("fillText").filter((c) => c.textAlign === "center");

    expect(labels.map((c) => c.args)).toEqual(
      track.ticks.map((t) => [
        t.label,
        playheadX(t.t, DURATION, WIDTH),
        20 + 8,
      ]),
    );

    const rules = rec.ops("moveTo").filter((c) => c.args[1] === 20);

    expect(rules.map((c) => c.args[0])).toEqual(
      track.ticks.map((t) => playheadX(t.t, DURATION, WIDTH)),
    );
  });

  it("one polyline per series in its CSS color, with the shared ink fallback", () => {
    const { p, rec } = painter();
    paintLines(p, track, 20);
    const series = rec.ops("stroke").filter((c) => c.lineWidth === 1.5);
    expect(series.map((c) => c.strokeStyle)).toEqual(["#ff0000", INK]);

    expect(
      rec.ops("lineTo").filter((c) => c.args[0] === WIDTH - 1),
    ).toHaveLength(track.series.length);
  });

  it("series labels read left to right in series order, ending at the right edge, uppercased", () => {
    const { p, rec } = painter();
    paintLines(p, track, 20);
    const labels = rec.ops("fillText").filter((c) => c.textAlign === "right");

    /* Two series: X sits one slot left of the edge, Y at the edge, so
       the row reads X Y (owner call 2026-08-26). */
    expect(labels.map((c) => c.args)).toEqual([
      ["X", WIDTH - 4 - 14, 20 + 60 - 4],
      ["Y", WIDTH - 4, 20 + 60 - 4],
    ]);

    expect(labels.map((c) => c.fillStyle)).toEqual(["#ff0000", INK]);
  });
});

describe("paintLabelChip", () => {
  it("boxes the measured label on a paper chip at the track's top-left", () => {
    const { p, rec } = painter();
    paintLabelChip(p, "FEED", 40);
    const w = 4 * 5; // recorder's measureText: 5px per character
    const box = rec.ops("fillRect");
    expect(box).toHaveLength(1);
    expect(box[0].args).toEqual([2, 42, w + 8, 12]);
    expect(box[0].fillStyle).toBe(PAPER);
    expect(rec.ops("strokeRect")[0].args).toEqual([2.5, 42.5, w + 7, 11]);
    const text = rec.ops("fillText");
    expect(text[0].args).toEqual(["FEED", 6, 51]);
    expect(text[0].fillStyle).toBe(ink(0.8));
    expect(text[0].textAlign).toBe("left");
  });
});

describe("paintAxis", () => {
  it("a tick and label every two seconds, from zero, short of the end", () => {
    const { p, rec } = painter();
    paintAxis(p, 100, DURATION);
    const ticks = rec.ops("moveTo");

    expect(ticks.map((c) => c.args)).toEqual(
      [0, 2, 4].map((t) => [playheadX(t, DURATION, WIDTH), 102]),
    );

    expect(rec.ops("fillText").map((c) => c.args)).toEqual(
      [0, 2, 4].map((t) => [`${t}s`, playheadX(t, DURATION, WIDTH) + 2, 111]),
    );
  });

  it("a label that would run off the right edge is dropped; its tick stays", () => {
    /* 19 s across 100 px: the 18 s tick lands at x = 94.7 and its 10 px
       label (5 px per character in the recording context) would end at
       106.7; "16s" (15 px from x = 84.2) spills too. Phone report
       2026-08-27: the demo's "18s" clipped to "18"; the owner chose an
       empty end over a flipped label crowding its neighbor. */
    const rec = recordingContext();

    const p: Painter = {
      ctx: rec.ctx,
      width: WIDTH,
      xAt: (t) => playheadX(t, 19, WIDTH),
      cssColor: () => INK,
    };

    paintAxis(p, 100, 19);
    expect(rec.ops("moveTo")).toHaveLength(10);
    const labels = rec.ops("fillText").map((c) => c.args[0]);
    expect(labels).toEqual(["0s", "2s", "4s", "6s", "8s", "10s", "12s", "14s"]);
    for (const c of rec.ops("fillText")) expect(c.textAlign).toBe("left");
  });

  it("a two-second timeline gets only the origin tick", () => {
    const { p, rec } = painter();
    paintAxis(p, 100, 2);
    expect(rec.ops("moveTo")).toHaveLength(1);
    expect(rec.ops("fillText")[0].args[0]).toBe("0s");
  });
});
