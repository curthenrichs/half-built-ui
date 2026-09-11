/* Shared test utilities, trimmed from the blog's test/helpers.ts to the
   parts the copied package suites use (task 3): FLUID_ART_POST and
   allHtml() were blog-content and dist-build helpers with no callers
   here, so they are left behind rather than copied unused. */
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
   the modal decorators use so tests exercise our logic, not jsdom's.
   Touches HTMLDialogElement only when called, so node-env tests
   importing this module are unaffected. */
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

/* Canvas call recorder for the path-player painters (they are pure over
   the context they are handed). Every method the painters and drawFrame
   use pushes {op, args} plus the style fields as they stood at call
   time, so a test can ask what color a given rect was painted in.
   measureText answers 5px per character. One definition here: the
   node-env paint suite and the jsdom transport suite both use it. */
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
