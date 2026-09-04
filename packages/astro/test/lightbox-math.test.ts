import { describe, it, expect } from "vitest";
import {
  fitZoom, clampZoom, normalizePan, initialView, zoomAt, readout,
  outOfWhack, MIN_NATIVE_ZOOM, MAX_NATIVE_ZOOM,
} from "../src/scripts/lightbox";

describe("fitZoom", () => {
  it("contains a large landscape image", () => {
    expect(fitZoom(4000, 3000, 800, 600)).toBeCloseTo(0.2);
  });
  it("never upscales a small image past 100%", () => {
    expect(fitZoom(400, 300, 800, 600)).toBe(1);
  });
  it("fits tall schematics to width instead of height", () => {
    // 1000x4000 in 800x600: contain would be 0.15; fit-width is 0.8
    expect(fitZoom(1000, 4000, 800, 600)).toBeCloseTo(0.8);
  });
});

describe("clampZoom", () => {
  it("floors at 10% of native and ceils at 8x native", () => {
    expect(clampZoom(0.01, 0.2)).toBe(MIN_NATIVE_ZOOM);
    expect(clampZoom(99, 0.2)).toBe(MAX_NATIVE_ZOOM);
  });
  it("keeps fit reachable when fit is below the 10% floor", () => {
    // a giant image in a small box: fit 0.05 must stay reachable
    expect(clampZoom(0.01, 0.05)).toBe(0.05);
  });
});

describe("normalizePan", () => {
  it("passes offsets through unclamped (pan is unbounded)", () => {
    const v = normalizePan({ zoom: 0.5, x: 9999, y: -9999 });
    expect(v).toEqual({ zoom: 0.5, x: 9999, y: -9999 });
  });
  it("flushes negative zero so readouts and equality checks see 0", () => {
    const v = normalizePan({ zoom: 1, x: -0, y: -0 });
    expect(v).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(Object.is(v.x, -0)).toBe(false);
  });
});

describe("initialView", () => {
  it("opens normal images at fit, centered", () => {
    expect(initialView(4000, 3000, 800, 600)).toEqual({ zoom: 0.2, x: 0, y: 0 });
  });
  it("opens tall schematics fit-width, scrolled to the top", () => {
    const v = initialView(1000, 4000, 800, 600);
    expect(v.zoom).toBeCloseTo(0.8);
    // top edge visible: center offset = (imgH*zoom - boxH) / 2
    expect(v.y).toBeCloseTo((4000 * 0.8 - 600) / 2);
    expect(v.x).toBe(0);
  });
  it("opens small images at 100% on the mat", () => {
    expect(initialView(400, 300, 800, 600)).toEqual({ zoom: 1, x: 0, y: 0 });
  });
});

describe("zoomAt", () => {
  it("keeps the image point under the cursor stationary", () => {
    const start = { zoom: 1, x: 0, y: 0 };
    const v = zoomAt(start, 2, 100, 50, 4000, 3000, 800, 600);
    expect(v.zoom).toBe(2);
    // image point p satisfies cx = p*z + x for both states:
    // p = (100 - 0) / 1 = 100; new x must be 100 - 100*2 = -100
    expect(v.x).toBe(-100);
    expect(v.y).toBe(-50);
  });
  it("clamps the zoom but not the pan", () => {
    const v = zoomAt({ zoom: 7, x: 0, y: 0 }, 4, 0, 0, 4000, 3000, 800, 600);
    expect(v.zoom).toBe(MAX_NATIVE_ZOOM);
  });
});

describe("readout", () => {
  it("shows FIT at fit zoom", () => {
    expect(readout({ zoom: 0.2, x: 0, y: 0 }, 0.2)).toBe("FIT · 0,0");
  });
  it("shows live percent and signed offsets otherwise", () => {
    expect(readout({ zoom: 2.13, x: 512.4, y: -273.6 }, 0.2)).toBe("213% · +512,-274");
  });
});

describe("outOfWhack", () => {
  // 1600x1200 at fit 0.5 scales to exactly the 800x600 box.
  it("is false at the centered initial view", () => {
    expect(outOfWhack({ zoom: 0.5, x: 0, y: 0 }, 1600, 1200, 800, 600)).toBe(false);
  });
  it("is false when zoomed far in but still centered", () => {
    expect(outOfWhack({ zoom: 8, x: 0, y: 0 }, 1600, 1200, 800, 600)).toBe(false);
  });
  it("is true once most of the image is dragged out of the window", () => {
    // x=700: only a 100px sliver of the 800px-wide image remains visible
    expect(outOfWhack({ zoom: 0.5, x: 700, y: 0 }, 1600, 1200, 800, 600)).toBe(true);
  });
  it("is true when the image is entirely outside the window", () => {
    expect(outOfWhack({ zoom: 0.5, x: 5000, y: 0 }, 1600, 1200, 800, 600)).toBe(true);
  });
  it("is false for a modest nudge", () => {
    expect(outOfWhack({ zoom: 0.5, x: 200, y: 0 }, 1600, 1200, 800, 600)).toBe(false);
  });
});
