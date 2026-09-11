/* Shared test utilities for consumers of @half-built/tooling. Adapted from
   half-built-robots-blog's test/helpers.ts (step 11.3 task 5): the two
   blog-content exports are dropped since neither means anything outside
   that repo. FLUID_ART_POST was a post slug shared by three of the blog's
   own suites; allHtml() walked a built dist/ tree looking for that blog's
   post pages. What is left is generic: DOM and canvas test scaffolding
   any consumer's suite can use. (packages/astro/test/helpers.ts made the
   same two drops independently for the package's own tests; this file
   serves outside consumers instead, so the overlap is expected, not
   duplication to dedupe.) */
import { vi } from "vitest";

/* rAF driven by the fake-timer clock, for suites under vi.useFakeTimers.
   Self-advancing frame stamp: do not lean on performance.now or Date.now
   here, fake timers do not reliably advance them across environments.
   Call after vi.useFakeTimers(); undone by vi.unstubAllGlobals(). */
export function stubRafOnFakeTimers(): void {
  let frameNow = 0;

  vi.stubGlobal(
    "requestAnimationFrame",
    (cb: FrameRequestCallback) =>
      setTimeout(() => {
        frameNow += 16;
        cb(frameNow);
      }, 16) as unknown as number,
  );

  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    clearTimeout(id);
  });
}

/* jsdom's <dialog> support has lagged the platform; polyfill the members
   modal decorators use so tests exercise your logic, not jsdom's. Touches
   HTMLDialogElement only when called, so node-env tests importing this
   module are unaffected. */
export function polyfillDialog(): void {
  const p = HTMLDialogElement.prototype;

  if (typeof p.showModal !== "function") {
    p.showModal = function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    };
  }

  if (typeof p.close !== "function") {
    p.close = function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
}

/* Canvas call recorder for canvas-painting code under test (it should be
   pure over the 2D context it is handed). Every recorded method pushes
   {op, args} plus the style fields as they stood at call time, so a test
   can ask what color a given rect was painted in. measureText answers 5px
   per character. */
export interface CanvasCall {
  op: string;
  args: unknown[];
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textAlign: string;
}
export interface RecordingContext {
  calls: CanvasCall[];
  ops: (op: string) => CanvasCall[];
  ctx: CanvasRenderingContext2D;
}
export function recordingContext(): RecordingContext {
  const calls: CanvasCall[] = [];

  const ctx: Record<string, unknown> = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "start",
  };

  const snap = (op: string, args: unknown[]): void => {
    calls.push({
      op,
      args,
      fillStyle: String(ctx.fillStyle),
      strokeStyle: String(ctx.strokeStyle),
      lineWidth: Number(ctx.lineWidth),
      font: String(ctx.font),
      textAlign: String(ctx.textAlign),
    });
  };

  for (const op of [
    "fillRect",
    "strokeRect",
    "beginPath",
    "moveTo",
    "lineTo",
    "stroke",
    "fillText",
    "scale",
    "clearRect",
    "drawImage",
    "save",
    "restore",
  ]) {
    ctx[op] = (...args: unknown[]): void => {
      snap(op, args);
    };
  }

  ctx.measureText = (text: string): { width: number } => {
    snap("measureText", [text]);
    return { width: text.length * 5 };
  };

  return {
    calls,
    ops: (op) => calls.filter((c) => c.op === op),
    ctx: ctx as unknown as CanvasRenderingContext2D,
  };
}
