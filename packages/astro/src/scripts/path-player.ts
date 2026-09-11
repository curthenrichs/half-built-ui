/* Generic transport-and-timeline player over a plate-modal (spec
   section 3). Knows nothing about fluids: samples, tracks, and the
   sink come from the caller, and the sample type S is the caller's
   too; the player only indexes the array and hands samples to the
   sink. Scrubbing is implemented but ships off (owner call
   2026-08-22); flip SCRUB to re-enable. */
import { buildPlateModal } from "./plate-modal";
import { createFrameLoop } from "./core/frame-loop";
import { ICON_PLAY, ICON_PAUSE, ICON_ROTATE_CCW } from "./core/icons";
import { playheadX, formatReadout, columnIndex } from "./path-player-math";
import {
  type Painter,
  paintBand,
  paintLines,
  paintLabelChip,
  paintAxis,
  INK,
} from "./path-player-paint";

/* Widened to `boolean` via assertion (not a `: boolean` annotation,
   which no-inferrable-types rejects on a literal) so flipping this to
   re-enable scrubbing is a one-line change: a literal type here would
   make the `if (SCRUB)` below statically always-false and trip the
   no-unnecessary-condition lint rule. Same widening idea as
   src/scripts/henry-loose.ts's matchMedia guard. */
const SCRUB = false as boolean;
const AXIS_H = 14;
const TRACK_GAP = 5;
/* Caption ids: one player per page today, but aria-controls needs a
   unique target if a second ever lands. */
let captionSeq = 0;

export interface BandTrack {
  kind: "band";
  height: number;
  /* Painted as a small chip at the track's top-left, naming the track
     the way the modal caption refers to it (FEED, PATH). */
  label?: string;
  colorAt: (i: number) => { r: number; g: number; b: number };
  envelopeAt: (i: number) => number;
}
export interface LinesTrack {
  kind: "lines";
  height: number;
  label?: string;
  series: { label: string; values: number[]; cssVar: string }[];
  regions: { t0: number; t1: number }[];
  ticks: { t: number; label: string }[];
}
export type TrackSpec = BandTrack | LinesTrack;

export interface PathPlayerConfig<S> {
  title: string;
  source: string;
  caption: string;
  duration: number;
  samples: S[];
  tracks: TrackSpec[];
  buildStage: (viewbox: HTMLElement) => boolean | undefined;
  sink: {
    start: (s: S) => void;
    move: (s: S) => void;
    stop: () => void;
    pause?: () => void;
    resume?: () => void;
  };
  /* Transport and caption-toggle text, defaulting to the English copy
     this player shipped with. A caller with its own site voice (or a
     future translation) overrides one, two, or all three. */
  labels?: { play?: string; restart?: string; about?: string };
}

export interface PathPlayerHandle {
  open: (opener: HTMLElement | null) => void;
  close: () => void;
  isPlaying: () => boolean;
}

/* Transport state shared with the optional scrub handlers. */
interface TransportState {
  t: number;
  playing: boolean;
  lastIdx: number;
}

/* Read-only timeline shipped (owner call 2026-08-22). When enabled:
   pointer drag pauses the clock and paints the emitter along the path;
   the fluid itself is never seekable, only the input. */
function attachScrub(
  timeline: HTMLElement,
  state: TransportState,
  duration: number,
  applyCurrent: (useStart: boolean) => void,
  setPlaying: (playing: boolean) => void,
): void {
  let active = false;
  let wasPlaying = false;

  const seek = (ev: PointerEvent): void => {
    const rect = timeline.getBoundingClientRect();

    const frac = Math.max(
      0,
      Math.min(1, (ev.clientX - rect.left) / (rect.width || 1)),
    );

    state.t = frac * duration;
  };

  timeline.addEventListener("pointerdown", (ev) => {
    active = true;
    wasPlaying = state.playing;
    state.playing = false;
    timeline.setPointerCapture(ev.pointerId);
    seek(ev);
    applyCurrent(true);
  });

  timeline.addEventListener("pointermove", (ev) => {
    if (!active) return;
    seek(ev);
    applyCurrent(false);
  });

  timeline.addEventListener("pointerup", () => {
    active = false;
    setPlaying(wasPlaying);
  });
}

export function createPathPlayer<S>(
  doc: Document,
  config: PathPlayerConfig<S>,
): PathPlayerHandle {
  const {
    play = "Play or pause",
    restart = "Restart",
    about = "ABOUT",
  } = config.labels ?? {};

  const pm = buildPlateModal(doc, { ariaLabel: config.title });
  pm.addLabel("topLeft", "pp-title").textContent = config.title;
  pm.addLabel("bottomLeft", "pp-source").textContent = config.source;
  const readout = pm.addLabel("bottomRight", "pp-readout");

  const viewbox = doc.createElement("div");
  viewbox.className = "pp-viewbox";
  const stageReady = config.buildStage(viewbox) !== false;

  /* Transport straddles the plate's bottom edge in the manner of the
     boxed labels (owner call 2026-08-23); the timeline gets the full
     plate width. */
  const transport = doc.createElement("div");
  transport.className = "pp-transport";
  const playBtn = doc.createElement("button");
  playBtn.type = "button";
  playBtn.className = "pp-play icon-box press-box";
  playBtn.setAttribute("aria-label", play);
  const restartBtn = doc.createElement("button");
  restartBtn.type = "button";
  restartBtn.className = "pp-restart icon-box press-box";
  restartBtn.setAttribute("aria-label", restart);
  restartBtn.innerHTML = ICON_ROTATE_CCW;

  if (!stageReady) {
    playBtn.disabled = true;
    restartBtn.disabled = true;
  }

  const timeline = doc.createElement("div");
  timeline.className = "pp-timeline";
  const tracksCanvas = doc.createElement("canvas");
  tracksCanvas.className = "pp-tracks";
  timeline.append(tracksCanvas);
  transport.append(playBtn, restartBtn);

  const caption = doc.createElement("p");
  caption.className = "pp-caption";
  caption.id = `pp-caption-${String(++captionSeq)}`;
  caption.textContent = config.caption;

  /* Phones: the caption is the biggest discretionary block in the
     plate (nine lines at xs), so it hides behind a toggle until asked
     for (spec 2026-08-25, item 1). Wider viewports never see the
     toggle (path-player.css) and always see the caption. */
  const captionToggle = doc.createElement("button");
  captionToggle.type = "button";

  captionToggle.className =
    "pp-caption-toggle boxed-label micro-label press-box";

  captionToggle.textContent = about;
  captionToggle.setAttribute("aria-controls", caption.id);

  /* Same widening as henry-loose.ts: jsdom has no matchMedia, and a
     bare typeof check reads as always-true to the lint. The query list
     type is widened too so a test stub without addEventListener is
     still valid. */
  interface PhoneQuery {
    matches: boolean;
    addEventListener?: (
      type: "change",
      cb: (ev: { matches: boolean }) => void,
    ) => void;
  }

  const phoneQuery = (): PhoneQuery | null => {
    const mediaQuery = (
      globalThis as { matchMedia?: (q: string) => PhoneQuery }
    ).matchMedia;

    if (!mediaQuery) return null;

    return mediaQuery.call(globalThis, "(max-width: 768px)");
  };

  const phone = (): boolean => phoneQuery()?.matches ?? false;

  const setCaptionShown = (shown: boolean): void => {
    caption.hidden = !shown;
    captionToggle.setAttribute("aria-expanded", String(shown));
  };

  captionToggle.addEventListener("click", () => {
    setCaptionShown(caption.hidden);
  });

  /* Rotating with the modal open crosses the breakpoint: follow it so
     a caption hidden in portrait is not stranded behind a toggle that
     landscape no longer shows (final review 2026-08-26). */
  phoneQuery()?.addEventListener?.("change", (ev) => {
    setCaptionShown(!ev.matches);
  });

  /* pp-plate scopes the player's narrow-viewport flex reflow without
     touching the lightbox's shared pm-plate rules. */
  pm.plate.classList.add("pp-plate");
  pm.plate.append(viewbox, timeline, captionToggle, caption, transport);

  const state: TransportState = { t: 0, playing: false, lastIdx: -1 };

  /* All tracks, their gaps, and the axis: the canvas's CSS height. */
  const timelineHeight =
    config.tracks.reduce((h, tr) => h + tr.height + TRACK_GAP, 0) + AXIS_H;

  let staticTracks: HTMLCanvasElement | null = null;

  const dpr = (): number => doc.defaultView?.devicePixelRatio ?? 1;

  const sampleIndexAt = (t: number): number =>
    columnIndex(t, config.duration, config.samples.length);

  const cssColor = (v: string): string =>
    (doc.defaultView
      ?.getComputedStyle(doc.documentElement)
      .getPropertyValue(v)
      .trim() ??
      "") ||
    INK;

  /* The tracks, axis, chips, and labels never change while the modal
     is open, so they paint once to an offscreen canvas at layout time;
     drawFrame stamps it and draws the playhead over it. */
  function paintStatic(width: number, scale: number): HTMLCanvasElement | null {
    const off = doc.createElement("canvas");
    off.width = Math.floor(width * scale);
    off.height = Math.floor(timelineHeight * scale);
    const ctx = off.getContext("2d");
    if (!ctx) return null; // jsdom: geometry is tested; painting is not
    ctx.scale(scale, scale);

    /* The tracks follow the theme: paper is the field well, ink and rule
       the theme's own, so the strip reads as part of the plate by day
       and by night (owner call 2026-08-26). */
    const p: Painter = {
      ctx,
      width,
      xAt: (t) => playheadX(t, config.duration, width),
      cssColor,
      paper: cssColor("--well"),
      ink: cssColor("--ink"),
      rule: cssColor("--rule"),
    };

    let top = 0;

    for (const track of config.tracks) {
      if (track.kind === "band") {
        paintBand(p, track, top, config.samples.length);
      } else paintLines(p, track, top);
      if (track.label) paintLabelChip(p, track.label, top);
      top += track.height + TRACK_GAP;
    }

    paintAxis(p, top, config.duration);
    return off;
  }

  function layoutTracks(): void {
    const scale = dpr();
    const w = timeline.clientWidth || 600;
    tracksCanvas.style.height = `${timelineHeight}px`;
    tracksCanvas.width = Math.floor(w * scale);
    tracksCanvas.height = Math.floor(timelineHeight * scale);
    staticTracks = paintStatic(w, scale);
  }

  function drawFrame(): void {
    const ctx = tracksCanvas.getContext("2d");
    if (!ctx || !staticTracks) return;
    const scale = dpr();
    ctx.clearRect(0, 0, tracksCanvas.width, tracksCanvas.height);
    ctx.drawImage(staticTracks, 0, 0);
    const px = playheadX(state.t, config.duration, tracksCanvas.width / scale);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.strokeStyle = cssColor("--ink");
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, timelineHeight - AXIS_H);
    ctx.stroke();
    ctx.restore();
  }

  function applyCurrent(useStart: boolean): void {
    const idx = sampleIndexAt(state.t);
    if (idx === state.lastIdx && !useStart) return;
    state.lastIdx = idx;
    const s = config.samples[idx];
    if (useStart) config.sink.start(s);
    else config.sink.move(s);
  }

  /* Old shape of this function was tick(now): computed dt itself from
     now/state.lastNow and re-armed its own requestAnimationFrame. The
     frame loop now owns the clock and the scheduling; this is just the
     per-frame body. dt is 0 on the first frame after any loop.start(),
     which preserves the old skip-first-frame behavior without a
     dedicated lastNow field. */
  function frame(dt: number): void {
    if (state.playing) {
      state.t += dt;

      if (state.t >= config.duration) {
        state.t -= config.duration;
        applyCurrent(true); // teleport at the wrap, no smear
      } else {
        applyCurrent(false);
      }
    }

    drawFrame();
    readout.textContent = formatReadout(state.t, config.duration);
  }

  /* Cast, not an optional fallback: this player is always built against
     a live document (same idiom the reduced-motion check below uses for
     doc.defaultView). Only the frame loop's own rAF/cAF calls need this;
     jsdom's stub in tests supplies them on the same window object. */
  const win = doc.defaultView as Window;
  const loop = createFrameLoop(win, frame, { clamp: 0.1, firstDt: 0 });

  /* Visibility pause (step 10): the loop halts while the tab is hidden
     and resumes when it returns with the dialog still open. Playback
     state is untouched; the frame loop's clock reset means the hidden
     gap never arrives as one giant dt. Registered once at build and
     never removed: the player has no destroy path and stays reopenable
     for the life of the page. */
  function onVisibility(): void {
    if (doc.hidden) loop.stop();
    else if (pm.dialog.hasAttribute("open")) loop.start();
  }

  doc.addEventListener("visibilitychange", onVisibility);

  function setPlaying(playing: boolean): void {
    state.playing = playing;
    playBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    playBtn.setAttribute("aria-pressed", `${playing}`);
    if (playing) applyCurrent(true);
    else config.sink.stop();
  }

  playBtn.addEventListener("click", () => {
    setPlaying(!state.playing);
  });

  restartBtn.addEventListener("click", () => {
    state.t = 0;
    applyCurrent(true);
  });

  pm.dialog.addEventListener("keydown", (ev) => {
    /* Space on a button is its native activation; handling it here too
       would toggle twice in one stroke. */
    if (ev.key === " " && !(ev.target instanceof HTMLButtonElement)) {
      ev.preventDefault();
      setPlaying(!state.playing);
    }
  });

  pm.dialog.addEventListener("close", () => {
    setPlaying(false);
    loop.stop();
    config.sink.pause?.();
  });

  if (SCRUB) {
    attachScrub(timeline, state, config.duration, applyCurrent, setPlaying);
  }

  return {
    open: (opener) => {
      loop.stop();
      pm.open(opener);
      setCaptionShown(!phone());
      layoutTracks();
      readout.textContent = formatReadout(state.t, config.duration);
      config.sink.resume?.();

      /* Reduced motion: open paused; the transport still plays on demand.
         jsdom has no matchMedia, hence the widened type (same guard as
         henry-loose.ts). Kept separate from the frame loop's `win`,
         which is cast non-null: this one must stay optional so a
         matchMedia-less jsdom does not throw. */
      const mmWin = doc.defaultView as {
        matchMedia?: typeof window.matchMedia;
      } | null;

      const reduced = mmWin?.matchMedia
        ? mmWin.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;

      if (stageReady && !reduced) setPlaying(true);
      loop.start();
    },
    close: () => {
      pm.close();
    },
    isPlaying: () => state.playing,
  };
}
