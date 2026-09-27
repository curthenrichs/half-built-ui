/* The path player demo. The stage is a neutral stand-in for a real
   renderer: a point tracing a Lissajous curve on a 2D canvas, so the
   transport, the tracks and the caption can be seen without any
   site-specific simulation behind them. Every color is read from the
   theme at paint time, so the stage and the band follow the palette
   editor and the theme toggle. */
import { createPathPlayer } from "@half-built/astro/scripts/path-player.ts";

interface Point {
  x: number;
  y: number;
}

/* Enough samples that the tracks read as curves, not steps, across a
   wide plate: the timeline maps one sample to each run of pixel
   columns. */
const N = 720;
const DURATION = 8;

const samples: Point[] = Array.from({ length: N }, (_, i) => {
  const t = (i / N) * Math.PI * 2;
  return { x: Math.sin(3 * t), y: Math.sin(2 * t) };
});

/* Distance to the next sample: the point's speed, which the band
   track draws as its envelope. */
const speeds = samples.map((s, i) => {
  const next = samples[(i + 1) % N];
  return Math.hypot(next.x - s.x, next.y - s.y);
});

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: n >> 16, g: (n >> 8) & 255, b: n & 255 };
}

export function mountPathDemo(doc: Document): void {
  const btn = doc.querySelector<HTMLElement>(".demo-path-player");
  if (!btn) return;

  const root = doc.documentElement;

  const token = (name: string): string =>
    getComputedStyle(root).getPropertyValue(name).trim();

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let last: Point = samples[0];

  /* The canvas backing store follows its CSS box (path-player.css
     fills the square viewbox with it) at the device pixel ratio. */
  function fit(c: HTMLCanvasElement): void {
    const dpr = doc.defaultView?.devicePixelRatio ?? 1;
    const w = Math.round(c.clientWidth * dpr);
    const h = Math.round(c.clientHeight * dpr);

    if (w > 0 && h > 0 && (c.width !== w || c.height !== h)) {
      c.width = w;
      c.height = h;
    }
  }

  function draw(s: Point): void {
    last = s;
    if (!ctx || !canvas) return;
    fit(canvas);
    const { width: w, height: h } = canvas;
    const r = Math.min(w, h) * 0.4;

    const at = (p: Point): [number, number] => [
      w / 2 + p.x * r,
      h / 2 - p.y * r,
    ];

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = token("--ink-muted") || "gray";
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = Math.max(1, w / 320);
    ctx.beginPath();

    samples.forEach((p, i) => {
      const [x, y] = at(p);
      if (i === 0) ctx?.moveTo(x, y);
      else ctx?.lineTo(x, y);
    });

    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;

    const [px, py] = at(s);
    ctx.fillStyle = token("--accent-1") || "currentColor";
    ctx.beginPath();
    ctx.arc(px, py, Math.max(6, w / 50), 0, Math.PI * 2);
    ctx.fill();
  }

  /* The band blends the two brand bases by the point's X. The player
     paints the band one column at a time from sample 0 upward, so the
     bases are read once at the start of each paint rather than per
     column. Channels are handed over on the player's 0 to 0.15 scale. */
  let ends: [Rgb, Rgb] | null = null;

  function colorAt(i: number): Rgb {
    if (i === 0 || !ends) {
      const fallback = { r: 128, g: 128, b: 128 };

      ends = [
        hexToRgb(token("--brand-1-500")) ?? fallback,
        hexToRgb(token("--brand-2-500")) ?? fallback,
      ];
    }

    const [a, b] = ends;
    const f = (samples[i].x + 1) / 2;

    const mix = (ca: number, cb: number): number =>
      ((ca + (cb - ca) * f) / 255) * 0.15;

    return { r: mix(a.r, b.r), g: mix(a.g, b.g), b: mix(a.b, b.b) };
  }

  const player = createPathPlayer<Point>(doc, {
    title: "Sample path",
    source: "Generated sample",
    caption:
      "A point tracing a closed curve. PATH plots its X and Y over one loop. MIX blends the two brand colors by X, and its line is the point's speed.",
    duration: DURATION,
    samples,
    tracks: [
      {
        kind: "band",
        height: 28,
        label: "MIX",
        colorAt,
        envelopeAt: (i) => speeds[i],
      },
      {
        kind: "lines",
        height: 60,
        label: "PATH",
        series: [
          { label: "X", values: samples.map((s) => s.x), cssVar: "--track-x" },
          { label: "Y", values: samples.map((s) => s.y), cssVar: "--track-y" },
        ],
        regions: [],
        ticks: [],
      },
    ],
    buildStage: (viewbox) => {
      canvas = doc.createElement("canvas");
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "A point tracing a closed curve");
      viewbox.append(canvas);
      ctx = canvas.getContext("2d");
      return ctx !== null;
    },
    sink: {
      start: draw,
      move: draw,
      stop: () => undefined,
      /* Called on every open, after the plate is laid out: paints the
         current point so a paused open (reduced motion) is not blank. */
      resume: () => {
        draw(last);
      },
    },
  });

  btn.addEventListener("click", () => {
    player.open(btn);
  });
}
