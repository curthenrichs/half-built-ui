import { describe, it, expect } from "vitest";
import { placeTip } from "../src/scripts/core/placement";

describe("placeTip", () => {
  const VP = { width: 800, height: 600 };
  const A = { left: 100, right: 160, top: 300, bottom: 316 };

  it("a fitting tip sits 2px out from the anchor's left, above it", () => {
    expect(placeTip(A, { width: 200, height: 30 }, VP)).toEqual({
      x: 98,
      y: 269,
      place: "above",
    });
  });

  it("overflowing the right edge clamps left exactly enough", () => {
    expect(
      placeTip({ ...A, left: 700, right: 760 }, { width: 200, height: 30 }, VP)
        .x,
    ).toBe(800 - 12 - 200);
  });

  it("a near-left anchor never pushes past the left edge", () => {
    expect(
      placeTip({ ...A, left: 4, right: 40 }, { width: 900, height: 30 }, VP).x,
    ).toBe(12);
  });

  it("above flips below when the tip would cross the viewport top", () => {
    const p = placeTip(
      { ...A, top: 20, bottom: 36 },
      { width: 200, height: 30 },
      VP,
    );

    expect(p.place).toBe("below");
    expect(p.y).toBe(37);
  });

  it("below flips above when bottom-clipped", () => {
    const p = placeTip(
      { ...A, top: 560, bottom: 576 },
      { width: 200, height: 30 },
      VP,
      "below",
    );

    expect(p.place).toBe("above");
    expect(p.y).toBe(529);
  });

  it("end alignment pins the tip's right edge 2px out from the anchor's right", () => {
    expect(placeTip(A, { width: 100, height: 30 }, VP, "above", "end").x).toBe(
      160 + 2 - 100,
    );
  });

  it("edge parameter is honored", () => {
    expect(
      placeTip(
        { ...A, left: 795, right: 799 },
        { width: 100, height: 30 },
        VP,
        "above",
        "start",
        0,
      ).x,
    ).toBe(700);
  });
});
