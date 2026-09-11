/* Track geometry for the path player, canvas-free (spec: geometry is
   pure and tested; the 2D painting consumes it). */
import { describe, it, expect } from "vitest";
import {
  normalizeSeries,
  playheadX,
  formatReadout,
  brightChannel,
  columnIndex,
  seriesY,
} from "../src/scripts/path-player-math";

describe("normalizeSeries", () => {
  it("maps min to 0 and max to 1", () => {
    const n = normalizeSeries([2, 4, 6]);
    expect(n.min).toBe(2);
    expect(n.max).toBe(6);
    expect(n.frac(2)).toBe(0);
    expect(n.frac(6)).toBe(1);
    expect(n.frac(4)).toBeCloseTo(0.5, 9);
  });

  it("centers a flat series", () => {
    expect(normalizeSeries([3, 3, 3]).frac(3)).toBe(0.5);
  });
});

describe("playheadX and readout", () => {
  it("maps time linearly across the width", () => {
    expect(playheadX(0, 10, 200)).toBe(0);
    expect(playheadX(5, 10, 200)).toBe(100);
    expect(playheadX(10, 10, 200)).toBe(200);
  });

  it("formats the instrument readout", () => {
    expect(formatReadout(6.04, 18.7)).toBe("T+06.0 / 18.7s");
    expect(formatReadout(0, 18.7)).toBe("T+00.0 / 18.7s");
  });
});

describe("brightChannel", () => {
  it("scales the 0..0.15 feed range to display 0..255", () => {
    expect(brightChannel(0)).toBe(0);
    expect(brightChannel(0.15)).toBe(255);
    expect(brightChannel(0.075)).toBe(128);
    expect(brightChannel(0.2)).toBe(255); // clamped
  });
});

describe("columnIndex", () => {
  it("maps the first and last columns to the first and last samples", () => {
    expect(columnIndex(0, 100, 60)).toBe(0);
    expect(columnIndex(99, 100, 60)).toBe(59);
  });

  it("spreads a long sample array across a narrow width proportionally", () => {
    expect(columnIndex(50, 100, 200)).toBe(100);
  });

  it("clamps past either edge", () => {
    expect(columnIndex(100, 100, 60)).toBe(59);
    expect(columnIndex(-5, 100, 60)).toBe(0);
  });

  it("serves time across duration the same way", () => {
    expect(columnIndex(1, 2, 60)).toBe(30);
    expect(columnIndex(2, 2, 60)).toBe(59);
  });
});

describe("seriesY", () => {
  it("keeps the line inside the padded band", () => {
    expect(seriesY(0, 20, 40, 5)).toBe(55); // bottom edge minus pad
    expect(seriesY(1, 20, 40, 5)).toBe(25); // top edge plus pad
    expect(seriesY(0.5, 20, 40, 5)).toBe(40); // midline
  });
});
