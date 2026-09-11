/* The rAF loop with dt clamp (step 10), one home for the pattern
   henry-loose.ts and path-player.ts each carried. now is the rAF
   timestamp: monotonic in a real browser, unlike Date.now(), which a
   wall-clock adjustment can move backward; the max(0, ...) floor is
   cheap belt-and-suspenders against that case feeding an integrator a
   negative dt. stop() resets the clock so a stop/start gap (a hidden
   tab, a closed dialog) never arrives as one giant dt. */
export interface FrameLoop {
  start(): void;
  stop(): void;
  running(): boolean;
}

export function createFrameLoop(
  win: Window,
  cb: (dt: number) => void,
  options: { clamp?: number; firstDt?: number } = {},
): FrameLoop {
  const { clamp = 0.05, firstDt = 0.016 } = options;
  let handle = 0;
  let last = 0;
  let live = false;

  function tick(now: number): void {
    if (!live) return;

    const elapsed = Math.max(0, (now - last) / 1000);
    const dt = last === 0 ? firstDt : Math.min(clamp, elapsed);

    last = now;
    cb(dt);
    // cb may have called stop() reentrantly; a fresh function body reads live without stale narrowing.
    scheduleNext();
  }

  function scheduleNext(): void {
    if (live) handle = win.requestAnimationFrame(tick);
  }

  return {
    start(): void {
      if (live) return;
      live = true;
      last = 0;
      handle = win.requestAnimationFrame(tick);
    },
    stop(): void {
      if (!live) return;
      live = false;
      win.cancelAnimationFrame(handle);
      last = 0;
    },
    running(): boolean {
      return live;
    },
  };
}
