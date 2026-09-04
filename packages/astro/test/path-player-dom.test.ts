// @vitest-environment jsdom
/* Shell behavior against a stub sink; canvas painting is not asserted
   (jsdom has no 2D context; the painter no-ops on a null context and
   the geometry is covered by path-player-math tests). */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createPathPlayer } from "../src/scripts/path-player";
import { polyfillDialog, stubRafOnFakeTimers, recordingContext, type RecordingContext } from "./helpers";

/* The blog's copy of this suite typed SAMPLES against fluid/path-pipeline's
   TimelineSample. path-player.ts is generic over the sample type (it "knows
   nothing about fluids"), and fluid/* stays blog-side (task 3 guard), so
   this package copy drops the import and lets the sample type infer from
   the literal below instead; the shape is unchanged. */
const SAMPLES = Array.from({ length: 60 }, (_, i) => ({
  t: i / 30,
  x: i / 60, y: -i / 60, z: 0.1,
  color: { r: 0.05, g: 0.075, b: 0.1 },
  radius: 0.55,
  wp: i < 30 ? 0 : 1,
  dwell: false,
}));

/* One shape for the spy sink: the declaration below and makePlayer's
   config both use it, so a grown sink (seek is the obvious next method)
   is a one-line change here. */
type SinkSpies = Record<"start" | "move" | "stop" | "pause" | "resume", ReturnType<typeof vi.fn>>;
let sink: SinkSpies;

/* Every test uses the beforeEach sink; makePlayer closes over it. */
function makePlayer() {
  return createPathPlayer(document, {
    title: "PATH PLAYER",
    source: "TEST",
    caption: "Test caption.",
    duration: 2,
    samples: SAMPLES,
    tracks: [],
    buildStage: (viewbox) => { viewbox.append(document.createElement("canvas")); return true; },
    sink,
  });
}

describe("createPathPlayer", () => {
  beforeEach(() => {
    polyfillDialog();
    /* An explicit null quiets jsdom's "Not implemented: getContext"
       stderr spam; the painter already no-ops on a null context. */
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    vi.useFakeTimers();
    stubRafOnFakeTimers();
    document.body.innerHTML = "<button id='opener'>run</button>";
    sink = { start: vi.fn(), move: vi.fn(), stop: vi.fn(), pause: vi.fn(), resume: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("open plays and calls the sink start; close pauses and stops", () => {
    const player = makePlayer();
    player.open(document.querySelector("#opener"));
    expect(player.isPlaying()).toBe(true);
    expect(sink.start).toHaveBeenCalledTimes(1);
    expect(sink.resume).toHaveBeenCalledTimes(1);
    player.close();
    expect(player.isPlaying()).toBe(false);
    expect(sink.stop).toHaveBeenCalled();
    expect(sink.pause).toHaveBeenCalledTimes(1);
    player.open(document.querySelector("#opener"));
    expect(sink.resume).toHaveBeenCalledTimes(2);
  });

  it("renders the labels, caption, and transport", () => {
    const player = makePlayer();
    player.open(null);
    expect(document.querySelector(".pp-title")?.textContent).toBe("PATH PLAYER");
    expect(document.querySelector(".pp-source")?.textContent).toBe("TEST");
    expect(document.querySelector(".pp-caption")?.textContent).toBe("Test caption.");
    expect(document.querySelector(".pp-readout")?.textContent).toBe("T+00.0 / 2.0s");
    expect(document.querySelector(".pp-play")).not.toBeNull();
    expect(document.querySelector(".pp-restart")).not.toBeNull();
  });

  it("play button toggles pause and aria-pressed", () => {
    const player = makePlayer();
    player.open(null);
    const play = document.querySelector<HTMLButtonElement>(".pp-play");
    if (!play) throw new Error("no play button");
    play.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(player.isPlaying()).toBe(false);
    expect(play.getAttribute("aria-pressed")).toBe("false");
    expect(sink.stop).toHaveBeenCalled();
    play.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(player.isPlaying()).toBe(true);
  });

  it("opens paused under prefers-reduced-motion, transport still plays", () => {
    const matchMedia = vi.fn((q: string) => ({ matches: q.includes("reduce"), media: q }));
    vi.stubGlobal("matchMedia", matchMedia);
    try {
      const player = makePlayer();
      player.open(null);
      expect(player.isPlaying()).toBe(false);
      expect(sink.start).not.toHaveBeenCalled();
      const play = document.querySelector<HTMLButtonElement>(".pp-play");
      if (!play) throw new Error("no play button");
      play.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(player.isPlaying()).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("Space toggles play only when not on a button", () => {
    const player = makePlayer();
    player.open(null);
    const play = document.querySelector<HTMLButtonElement>(".pp-play");
    if (!play) throw new Error("no play button");
    // Space with the button as target: native activation handles it,
    // the global handler must ignore it, so state stays playing.
    play.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(player.isPlaying()).toBe(true);
    // Space on the dialog itself toggles.
    document.querySelector("dialog")?.dispatchEvent(
      new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(player.isPlaying()).toBe(false);
  });

  it("advances the readout under the fake clock", () => {
    const player = makePlayer();
    player.open(null);
    vi.advanceTimersByTime(500);
    const txt = document.querySelector(".pp-readout")?.textContent ?? "";
    expect(txt).not.toBe("T+00.0 / 2.0s");
    expect(sink.move).toHaveBeenCalled();
    player.close();
  });

  /* Regression (2026-08-23): a click targeting the icon svg inside the
     play button got detached by setPlaying's innerHTML swap mid-bubble;
     the veil check then read the detached target as outside the zone
     and closed the dialog. The veil check is identity now; this locks
     it. */
  it("a click on the play button's icon must not close the dialog", () => {
    const player = makePlayer();
    player.open(null);
    const svg = document.querySelector(".pp-play svg");
    if (!svg) throw new Error("no play icon");
    svg.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.querySelector("dialog")?.hasAttribute("open")).toBe(true);
    expect(player.isPlaying()).toBe(false); // the click still toggled
  });

  /* The no-WebGL path (spec error table): fallback stage disables the
     transport and never autoplays. Untestable by hand on hardware that
     has WebGL, which is why it gets a test. */
  it("buildStage returning false disables the transport and skips autoplay", () => {
    const player = createPathPlayer(document, {
      title: "T", source: "S", caption: "C",
      duration: 2, samples: SAMPLES, tracks: [],
      buildStage: () => false,
      sink,
    });
    player.open(null);
    expect(document.querySelector("dialog")?.hasAttribute("open")).toBe(true);
    expect(document.querySelector<HTMLButtonElement>(".pp-play")?.disabled).toBe(true);
    expect(document.querySelector<HTMLButtonElement>(".pp-restart")?.disabled).toBe(true);
    expect(player.isPlaying()).toBe(false);
    expect(sink.start).not.toHaveBeenCalled();
  });

  it("restart resets the clock; while paused it repositions without resuming", () => {
    const player = makePlayer();
    player.open(null);
    vi.advanceTimersByTime(500);
    const restart = document.querySelector<HTMLButtonElement>(".pp-restart");
    if (!restart) throw new Error("no restart button");
    restart.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    vi.advanceTimersByTime(20); // one frame so the readout repaints
    expect(document.querySelector(".pp-readout")?.textContent).toBe("T+00.0 / 2.0s");
    expect(player.isPlaying()).toBe(true);
    // Pause, then restart: the emitter repositions (sink.start) but
    // playback stays paused.
    document.querySelector<HTMLButtonElement>(".pp-play")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(player.isPlaying()).toBe(false);
    const startsBefore = sink.start.mock.calls.length;
    restart.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(sink.start.mock.calls.length).toBe(startsBefore + 1);
    expect(player.isPlaying()).toBe(false);
  });

  /* Painting, through a recording context handed back from getContext
     (one per canvas, keyed by identity): the offscreen static canvas
     is painted once at layout, the visible canvas gets that image
     stamped and a playhead drawn every frame. */
  function recordCanvases(): Map<HTMLCanvasElement, RecordingContext> {
    const recorders = new Map<HTMLCanvasElement, RecordingContext>();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      function (this: HTMLCanvasElement) {
        let r = recorders.get(this);
        if (!r) { r = recordingContext(); recorders.set(this, r); }
        return r.ctx;
      },
    );
    return recorders;
  }
  const TRACKS = [
    {
      kind: "band" as const, height: 30, label: "FEED",
      colorAt: (i: number) => SAMPLES[i].color,
      envelopeAt: (i: number) => SAMPLES[i].radius,
    },
    {
      kind: "lines" as const, height: 60, label: "PATH",
      series: [
        { label: "x", values: SAMPLES.map((s) => s.x), cssVar: "--track-x" },
        { label: "y", values: SAMPLES.map((s) => s.y), cssVar: "--track-y" },
      ],
      regions: [{ t0: 0.5, t1: 1 }],
      ticks: [{ t: 1, label: "2" }],
    },
  ];
  function makePaintedPlayer() {
    return createPathPlayer(document, {
      title: "T", source: "S", caption: "C", duration: 2, samples: SAMPLES, tracks: TRACKS,
      buildStage: () => true,
      sink,
    });
  }
  const visibleCanvas = (): HTMLCanvasElement => {
    const c = document.querySelector<HTMLCanvasElement>(".pp-tracks");
    if (!c) throw new Error("no tracks canvas");
    return c;
  };

  it("paints the static tracks at layout and stamps them under the playhead each frame", () => {
    const recorders = recordCanvases();
    const player = makePaintedPlayer();
    player.open(null);
    const canvas = visibleCanvas();
    // jsdom reports no layout width, so the player falls back to 600.
    expect(canvas.style.height).toBe("114px"); // 30 + 5 + 60 + 5 + axis 14
    expect(canvas.width).toBe(600);
    const offscreen = [...recorders.entries()].find(([c]) => c !== canvas)?.[1];
    if (!offscreen) throw new Error("static canvas was never painted");
    expect(offscreen.ops("scale")).toHaveLength(1);
    // 600 band columns, the paper panel, one region, two chips
    expect(offscreen.ops("fillRect")).toHaveLength(600 + 1 + 1 + 2);
    const texts = offscreen.ops("fillText").map((c) => c.args[0]);
    expect(texts).toEqual(expect.arrayContaining(["FEED", "PATH", "2", "X", "Y", "0s"]));

    vi.advanceTimersByTime(48); // three frames
    const visible = recorders.get(canvas);
    if (!visible) throw new Error("visible canvas was never drawn");
    expect(visible.ops("clearRect")).toHaveLength(3);
    expect(visible.ops("drawImage")).toHaveLength(3);
    const heads = visible.ops("stroke").filter((c) => c.lineWidth === 2);
    expect(heads).toHaveLength(3);
    const xs = visible.ops("moveTo").map((c) => c.args[0] as number);
    // the first frame only sets the clock's reference, so it paints t = 0
    expect(xs[0]).toBe(0);
    expect(xs[1]).toBeGreaterThan(xs[0]);
    expect(xs[2]).toBeGreaterThan(xs[1]);
    expect(visible.ops("lineTo").map((c) => c.args[1])).toEqual([100, 100, 100]); // timeline minus the axis
    player.close();
  });

  it("cssColor reads a custom property, trimmed, and falls back to ink", () => {
    const recorders = recordCanvases();
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      getPropertyValue: (v: string) => (v === "--track-x" ? " #ff0000 " : ""),
    } as unknown as CSSStyleDeclaration);
    const player = makePaintedPlayer();
    player.open(null);
    const canvas = visibleCanvas();
    const offscreen = [...recorders.entries()].find(([c]) => c !== canvas)?.[1];
    if (!offscreen) throw new Error("static canvas was never painted");
    const series = offscreen.ops("stroke").filter((c) => c.lineWidth === 1.5).map((c) => c.strokeStyle);
    // band envelope, then x in its token color, then y on the fallback
    expect(series).toEqual(["rgba(255, 255, 255, 0.9)", "#ff0000", "#111111"]);
    player.close();
  });

  it("wraps at duration: the emitter teleports and the clock restarts", () => {
    const player = makePlayer();
    player.open(null);
    expect(sink.start).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2200); // duration is 2 s
    expect(sink.start.mock.calls.length).toBeGreaterThanOrEqual(2);
    const txt = document.querySelector(".pp-readout")?.textContent ?? "";
    const t = Number(/T\+(\d+\.\d)/.exec(txt)?.[1]);
    expect(t).toBeLessThan(2);
    expect(player.isPlaying()).toBe(true);
    player.close();
  });

  it("on phones the caption starts hidden behind the toggle, which reveals it", () => {
    /* The nine-line caption was the biggest block in a plate that ran
       100px past a 664px phone (spec 2026-08-25, item 1). */
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(max-width: 768px)" }));
    const player = makePlayer();
    player.open(null);
    const toggle = document.querySelector<HTMLButtonElement>(".pp-caption-toggle");
    const caption = document.querySelector<HTMLElement>(".pp-caption");
    if (!toggle || !caption) throw new Error("toggle or caption missing");
    expect(caption.hidden).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(caption.id);
    expect(caption.id).not.toBe("");
    toggle.click();
    expect(caption.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    toggle.click();
    expect(caption.hidden).toBe(true);
  });

  it("where the phone query does not match the caption is visible from the start", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const player = makePlayer();
    player.open(null);
    expect(document.querySelector<HTMLElement>(".pp-caption")?.hidden).toBe(false);
    expect(document.querySelector(".pp-caption-toggle")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("without matchMedia at all (jsdom) the caption is visible", () => {
    const player = makePlayer();
    player.open(null);
    expect(document.querySelector<HTMLElement>(".pp-caption")?.hidden).toBe(false);
  });

  it("crossing the phone breakpoint while open follows the query", () => {
    const captured: { cb?: (ev: { matches: boolean }) => void } = {};
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q === "(max-width: 768px)",
      addEventListener: (_type: "change", cb: (ev: { matches: boolean }) => void) => { captured.cb = cb; },
    }));
    const player = makePlayer();
    player.open(null);
    const caption = document.querySelector<HTMLElement>(".pp-caption");
    const toggle = document.querySelector(".pp-caption-toggle");
    if (!caption || !toggle || !captured.cb) throw new Error("caption, toggle, or listener missing");
    expect(caption.hidden).toBe(true);
    captured.cb({ matches: false });
    expect(caption.hidden).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    captured.cb({ matches: true });
    expect(caption.hidden).toBe(true);
  });

  /* Step 10: the path player now rides core/frame-loop, which gains it
     a visibility pause it never had. Playback state is untouched by the
     pause; only the loop halts and resumes. */
  describe("visibility pause (step 10)", () => {
    afterEach(() => {
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
    });

    it("hides: the loop stops while the document is hidden", () => {
      const player = makePlayer();
      player.open(null);
      vi.advanceTimersByTime(48); // a few frames
      const before = document.querySelector(".pp-readout")?.textContent ?? "";
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(200); // would be several more frames if still running
      const after = document.querySelector(".pp-readout")?.textContent ?? "";
      expect(after).toBe(before);
      player.close();
    });

    it("returns: the loop resumes without a dt jump", () => {
      const player = makePlayer();
      player.open(null);
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(5000); // a long hidden gap
      Object.defineProperty(document, "hidden", { value: false, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      vi.advanceTimersByTime(16); // one frame back
      const txt = document.querySelector(".pp-readout")?.textContent ?? "";
      const t = Number(/T\+(\d+\.\d)/.exec(txt)?.[1]);
      expect(t).toBeLessThan(0.2); // clamped to one frame, not a 5s smear
      player.close();
    });
  });
});
