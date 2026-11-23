// @vitest-environment jsdom
/* The shipped test kit's DOM and canvas scaffolding, tested where it
   ships: consumers and this repo's own package suites both use it. */
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  stubRafOnFakeTimers,
  polyfillDialog,
  recordingContext,
} from "../src/test-kit/helpers.ts";

describe("stubRafOnFakeTimers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("runs frames on the fake clock with a self-advancing stamp", () => {
    vi.useFakeTimers();
    stubRafOnFakeTimers();
    const stamps: number[] = [];

    requestAnimationFrame((t) => {
      stamps.push(t);
    });

    requestAnimationFrame((t) => {
      stamps.push(t);
    });

    expect(stamps).toEqual([]);
    vi.advanceTimersByTime(16);
    expect(stamps).toEqual([16, 32]);
  });

  it("cancelAnimationFrame stops a pending frame", () => {
    vi.useFakeTimers();
    stubRafOnFakeTimers();
    const ran = vi.fn();
    cancelAnimationFrame(requestAnimationFrame(ran));
    vi.advanceTimersByTime(100);
    expect(ran).not.toHaveBeenCalled();
  });
});

describe("polyfillDialog", () => {
  /* Each member is cleared first so the polyfill, not jsdom, answers;
     the originals go back after. */
  const MEMBERS = ["show", "showModal", "close"] as const;

  const withoutMembers = (run: () => void): void => {
    const p = HTMLDialogElement.prototype;

    const saved = MEMBERS.map(
      (m) => [m, Object.getOwnPropertyDescriptor(p, m)] as const,
    );

    for (const m of MEMBERS) Reflect.deleteProperty(p, m);

    try {
      run();
    } finally {
      for (const [m, d] of saved) {
        Reflect.deleteProperty(p, m);
        if (d) Object.defineProperty(p, m, d);
      }
    }
  };

  it("fills in show, showModal, and close where they are missing", () => {
    withoutMembers(() => {
      polyfillDialog();
      const d = document.createElement("dialog");
      const closed = vi.fn();
      d.addEventListener("close", closed);

      d.show();
      expect(d.hasAttribute("open")).toBe(true);
      d.close();
      expect(d.hasAttribute("open")).toBe(false);
      expect(closed).toHaveBeenCalledTimes(1);

      d.showModal();
      expect(d.hasAttribute("open")).toBe(true);
    });
  });

  it("leaves a member that already exists alone", () => {
    withoutMembers(() => {
      const own = vi.fn();
      HTMLDialogElement.prototype.show = own;
      polyfillDialog();
      document.createElement("dialog").show();
      expect(own).toHaveBeenCalledTimes(1);
    });
  });
});

describe("recordingContext", () => {
  it("records each call with the style fields as they stood at the call", () => {
    const { ctx, calls, ops } = recordingContext();
    ctx.fillStyle = "#111111";
    ctx.fillRect(0, 0, 10, 10);
    ctx.fillStyle = "#222222";
    ctx.lineWidth = 2;
    ctx.fillRect(5, 5, 1, 1);
    ctx.beginPath();

    expect(calls.map((c) => c.op)).toEqual([
      "fillRect",
      "fillRect",
      "beginPath",
    ]);

    expect(ops("fillRect").map((c) => [c.fillStyle, c.lineWidth])).toEqual([
      ["#111111", 1],
      ["#222222", 2],
    ]);

    expect(ops("fillRect")[1]?.args).toEqual([5, 5, 1, 1]);
  });

  it("measureText answers five pixels per character and is recorded", () => {
    const { ctx, ops } = recordingContext();
    expect(ctx.measureText("abcd").width).toBe(20);
    expect(ops("measureText")[0]?.args).toEqual(["abcd"]);
  });
});
