// @vitest-environment jsdom
/* The shared rAF loop with dt clamp (step 10), one home for the
   pattern henry-loose.ts and path-player.ts each carried. rAF is
   stubbed onto the fake-timer clock (16ms frames). */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createFrameLoop } from "../src/scripts/core/frame-loop";
import { stubRafOnFakeTimers } from "./helpers";

describe("createFrameLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stubRafOnFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("ticks with clamped dt and the firstDt opening frame", () => {
    const dts: number[] = [];
    const loop = createFrameLoop(window, (dt) => dts.push(dt));
    loop.start();
    vi.advanceTimersByTime(48);
    expect(dts.length).toBeGreaterThanOrEqual(2);
    expect(dts[0]).toBeCloseTo(0.016, 3);

    for (const dt of dts.slice(1)) {
      expect(dt).toBeGreaterThan(0);
      expect(dt).toBeLessThanOrEqual(0.05);
    }
  });

  it("firstDt: 0 reports no opening advance", () => {
    const dts: number[] = [];
    const loop = createFrameLoop(window, (dt) => dts.push(dt), { firstDt: 0 });
    loop.start();
    vi.advanceTimersByTime(32);
    expect(dts[0]).toBe(0);
  });

  it("stop() halts ticking and running() reflects state", () => {
    const dts: number[] = [];
    const loop = createFrameLoop(window, (dt) => dts.push(dt));
    expect(loop.running()).toBe(false);
    loop.start();
    expect(loop.running()).toBe(true);
    vi.advanceTimersByTime(32);
    loop.stop();
    expect(loop.running()).toBe(false);
    const n = dts.length;
    vi.advanceTimersByTime(160);
    expect(dts.length).toBe(n);
  });

  it("a stop/start gap does not leak into dt", () => {
    const dts: number[] = [];
    const loop = createFrameLoop(window, (dt) => dts.push(dt));
    loop.start();
    vi.advanceTimersByTime(32);
    loop.stop();
    vi.advanceTimersByTime(5000);
    loop.start();
    const before = dts.length;
    vi.advanceTimersByTime(32);
    expect(dts[before]).toBeCloseTo(0.016, 3);
    for (const dt of dts.slice(before)) expect(dt).toBeLessThanOrEqual(0.05);
  });

  it("start() while running is a no-op (no double ticking)", () => {
    const dts: number[] = [];
    const loop = createFrameLoop(window, (dt) => dts.push(dt));
    loop.start();
    loop.start();
    vi.advanceTimersByTime(64);
    expect(dts.length).toBeLessThanOrEqual(5);
  });
});
