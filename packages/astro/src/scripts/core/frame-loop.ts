/* The rAF loop with dt clamp (step 10), one home for the pattern
   henry-loose.ts and path-player.ts each carried. now is the rAF
   timestamp: monotonic in a real browser, unlike Date.now(), which a
   wall-clock adjustment can move backward; the max(0, ...) floor is
   cheap belt-and-suspenders against that case feeding an integrator a
   negative dt. stop() resets the clock so a stop/start gap (a hidden
   tab, a closed dialog) never arrives as one giant dt. A stop, a
   start, or both called reentrantly from inside cb keep exactly one
   scheduled chain: each generation is stamped at schedule time, and a
   tick from a stale generation is dropped instead of rescheduling
   itself alongside the newer chain. */
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
  let gen = 0;

  function tick(now: number, mine: number): void {
    if (!live || mine !== gen) return;

    const elapsed = Math.max(0, (now - last) / 1000);
    const dt = last === 0 ? firstDt : Math.min(clamp, elapsed);

    last = now;
    cb(dt);

    // cb may have called stop() and/or start() reentrantly; gen moves
    // on either call, so mine still matching gen here already means
    // this chain is still the live one.
    if (mine === gen) {
      handle = win.requestAnimationFrame((now2) => {
        tick(now2, mine);
      });
    }
  }

  return {
    start(): void {
      if (live) return;
      live = true;
      last = 0;
      gen++;
      const mine = gen;

      handle = win.requestAnimationFrame((now) => {
        tick(now, mine);
      });
    },
    stop(): void {
      if (!live) return;
      live = false;
      gen++;
      win.cancelAnimationFrame(handle);
      last = 0;
    },
    running(): boolean {
      return live;
    },
  };
}
