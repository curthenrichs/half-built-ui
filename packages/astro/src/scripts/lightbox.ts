/* Image lightbox (spec docs/superpowers/specs/2026-07-30-image-lightbox-design.md).
   Exported pure math plus mountLightbox, on the island contract (step 9):
   mount(root, options?) returns a destroy handle; claim() makes a second
   mount over an already-wired link a no-op. Called from Base.astro's
   script block and testable under jsdom. */

import { claim, release, type Island, type IslandHandle } from "./core/island";
import { iconButton, docOf } from "./core/dom";
import { buildPlateModal } from "./plate-modal";
import { ICON_CHEVRON_LEFT, ICON_CHEVRON_RIGHT } from "./core/icons";

export interface ZoomView {
  zoom: number;
  x: number;
  y: number;
}

export const MIN_NATIVE_ZOOM = 0.1;
export const MAX_NATIVE_ZOOM = 8;
export const TALL_ASPECT = 3;
export const FALLBACK_BOX = { w: 800, h: 600 };

/* HOME appears once the visible image-window overlap drops below this
   fraction of whichever is smaller, the scaled image or the window. */
const WHACK_FRACTION = 0.25;

/* zoom is CSS px per image px (1 = 100%); fit contains the image, except
   tall schematics fit width, and small images never upscale past 100%. */
export function fitZoom(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
): number {
  if (imgH / imgW >= TALL_ASPECT) return boxW / imgW;
  return Math.min(boxW / imgW, boxH / imgH, 1);
}

/* Floor: 10% of native for every image, or the fit zoom when fit is
   already below that, so the fit view stays reachable (owner adjustment
   2026-08-01; originally 50% of fit, which read as arbitrary per-image
   percentages). Ceiling: 800% of native. */
export function clampZoom(zoom: number, fit: number): number {
  return Math.min(
    Math.max(zoom, Math.min(MIN_NATIVE_ZOOM, fit)),
    MAX_NATIVE_ZOOM,
  );
}

/* x/y offset the image center from the viewbox center. Pan is unbounded
   (owner adjustment 2026-08-01): the mat is the world and the image drags
   freely; HOME, double-click, and 0 snap it back. The + 0 flushes IEEE
   negative zero so readouts never show "-0" and toEqual({ x: 0 }) style
   assertions pass. */
export function normalizePan(view: ZoomView): ZoomView {
  return { zoom: view.zoom, x: view.x + 0, y: view.y + 0 };
}

export function initialView(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
): ZoomView {
  const zoom = fitZoom(imgW, imgH, boxW, boxH);

  const tall = imgH / imgW >= TALL_ASPECT;
  const centered = Math.max(0, (imgH * zoom - boxH) / 2);
  const y = tall ? centered : 0;

  return normalizePan({ zoom, x: 0, y });
}

/* Anchor-point zoom: the image point under (cx, cy) stays put. Cursor
   coordinates are relative to the viewbox center. */
export function zoomAt(
  view: ZoomView,
  factor: number,
  cx: number,
  cy: number,
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
): ZoomView {
  const fit = fitZoom(imgW, imgH, boxW, boxH);
  const zoom = clampZoom(view.zoom * factor, fit);
  const s = zoom / view.zoom;
  return normalizePan({
    zoom,
    x: cx - (cx - view.x) * s,
    y: cy - (cy - view.y) * s,
  });
}

/* True when the view has wandered far enough that the user likely wants
   a way home: the image-window overlap is under WHACK_FRACTION of the
   smaller of the two areas (so a centered deep zoom is never "whack"). */
export function outOfWhack(
  view: ZoomView,
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
): boolean {
  const w = imgW * view.zoom;
  const h = imgH * view.zoom;

  const overlapW =
    Math.min(view.x + w / 2, boxW / 2) - Math.max(view.x - w / 2, -boxW / 2);

  const overlapH =
    Math.min(view.y + h / 2, boxH / 2) - Math.max(view.y - h / 2, -boxH / 2);

  const overlap = Math.max(0, overlapW) * Math.max(0, overlapH);
  return overlap < WHACK_FRACTION * Math.min(w * h, boxW * boxH);
}

export function readout(view: ZoomView, fit: number, prefix = "FIT"): string {
  const sign = (n: number): string => {
    const r = Math.round(n);
    return r >= 0 ? `+${String(r)}` : String(r);
  };

  if (view.zoom === fit && view.x === 0 && view.y === 0) {
    return `${prefix} · 0,0`;
  }

  if (view.zoom === fit) return `${prefix} · ${sign(view.x)},${sign(view.y)}`;
  return `${String(Math.round(view.zoom * 100))}% · ${sign(view.x)},${sign(view.y)}`;
}

export interface LightboxLabels {
  viewer: string;
  close: string;
  prev: string;
  next: string;
  home: string;
  homeAction: string;
  image: (i: number, n: number) => string;
}

export interface LightboxOptions {
  selector?: string;
  /* Ancestors whose contained links form one navigable set. The defaults
     are the containers the package's own Gallery and Walkthrough render.
     Grouping keys on the mount's selector (step 9.5; it used to query the
     default class literally, so an overridden selector silently broke
     sets). */
  groupSelector?: string;
  labels?: Partial<LightboxLabels>;
}

const DEFAULT_LABELS: LightboxLabels = {
  viewer: "Image viewer",
  close: "Close image viewer",
  prev: "Previous image",
  next: "Next image",
  home: "HOME",
  homeAction: "Reset view to fit",
  image: (i, n) => `Image ${String(i)} of ${String(n)}`,
};

interface Item {
  href: string;
  w: number;
  h: number;
  caption: string;
  thumb: string;
}

interface Refs {
  dialog: HTMLDialogElement;
  zone: HTMLDivElement;
  prevBtn: HTMLButtonElement;
  nextBtn: HTMLButtonElement;
  closeBtn: HTMLButtonElement;
  counter: HTMLSpanElement;
  viewbox: HTMLDivElement;
  img: HTMLImageElement;
  caption: HTMLParagraphElement;
  dims: HTMLSpanElement;
  readoutEl: HTMLSpanElement;
  homeBtn: HTMLButtonElement;
  thumbs: HTMLDivElement;
  pmOpen: (opener: HTMLElement | null) => void;
}

function itemFor(link: HTMLAnchorElement): Item {
  const img = link.querySelector("img");
  return {
    href: link.getAttribute("href") ?? "",
    w: Number(link.dataset.lbW ?? "0"),
    h: Number(link.dataset.lbH ?? "0"),
    caption: link.dataset.lbCaption ?? "",
    thumb:
      (img?.currentSrc ?? "") ||
      (img?.getAttribute("src") ?? "") ||
      (link.getAttribute("href") ?? ""),
  };
}

/* Gallery plates sharing a .gallery-plates ancestor form a set, and so do
   the photos of one Walkthrough (spec 2026-08-15-walkthrough-steps-design).
   Every other image opens solo (spec: no implicit chaining). */
function setFor(
  link: HTMLAnchorElement,
  selector: string,
  groupSelector: string,
): HTMLAnchorElement[] {
  const set = link.closest(groupSelector);
  if (!set) return [link];
  return [...set.querySelectorAll<HTMLAnchorElement>(selector)];
}

/* The in-page rendition shows instantly; the untransformed original swaps
   in when loaded. dataset.pending guards against stale loads after
   navigating within a set. Returns the probe for tests. */
export function swapToFull(
  target: HTMLImageElement,
  href: string,
  doc: Document,
): HTMLImageElement | null {
  if (target.getAttribute("src") === href) return null;
  target.dataset.pending = href;
  const probe = doc.createElement("img");

  probe.addEventListener("load", () => {
    if (target.dataset.pending === href) {
      target.src = href;
      delete target.dataset.pending;
    }
  });

  probe.src = href;
  return probe;
}

function buildDialog(doc: Document, labels: LightboxLabels): Refs {
  const pm = buildPlateModal(doc, {
    ariaLabel: labels.viewer,
    legacyPrefix: "lb",
  });

  const { dialog, zone, plate } = pm;
  const closeBtn = pm.closeBtn;
  closeBtn.setAttribute("aria-label", labels.close);

  const main = doc.createElement("div");
  main.className = "lb-main";

  const prevBtn = iconButton(
    doc,
    "lb-arrow lb-prev icon-box",
    labels.prev,
    ICON_CHEVRON_LEFT,
  );

  const nextBtn = iconButton(
    doc,
    "lb-arrow lb-next icon-box",
    labels.next,
    ICON_CHEVRON_RIGHT,
  );

  /* The bar owns counter + close so the mobile header-row layout keeps
     working; the close button is re-parented out of the plate root. */
  const bar = doc.createElement("div");
  bar.className = "lb-bar";
  const counter = pm.addLabel("topLeft", "lb-counter");
  counter.setAttribute("aria-live", "polite");
  bar.append(counter, closeBtn);

  const viewbox = doc.createElement("div");
  viewbox.className = "lb-viewbox";
  const img = doc.createElement("img");
  img.className = "lb-img";
  /* Native HTML5 image drag hijacks mouse panning: the browser starts a
     drag (no-drop cursor) and fires pointercancel, killing pan tracking.
     Opt the pan surface out of it on both layers. */
  img.draggable = false;

  img.addEventListener("dragstart", (ev) => {
    ev.preventDefault();
  });

  const homeBtn = doc.createElement("button");
  homeBtn.type = "button";
  homeBtn.className = "lb-home boxed-label micro-label";
  homeBtn.setAttribute("aria-label", labels.homeAction);
  homeBtn.textContent = labels.home;
  homeBtn.hidden = true;
  viewbox.append(img, homeBtn);

  const caption = doc.createElement("p");
  caption.className = "lb-caption";

  const foot = doc.createElement("div");
  foot.className = "lb-foot";
  const dims = pm.addLabel("bottomLeft", "lb-dims");
  const readoutEl = pm.addLabel("bottomRight", "lb-readout");
  foot.append(dims, readoutEl);

  plate.append(bar, viewbox, caption, foot);
  main.append(prevBtn, plate, nextBtn);

  const thumbs = doc.createElement("div");
  thumbs.className = "lb-thumbs";

  zone.append(main, thumbs);
  return {
    dialog,
    zone,
    prevBtn,
    nextBtn,
    closeBtn,
    counter,
    viewbox,
    img,
    caption,
    dims,
    readoutEl,
    homeBtn,
    thumbs,
    pmOpen: pm.open,
  };
}

export const mountLightbox: Island<LightboxOptions> = (
  root,
  options = {},
): IslandHandle => {
  const {
    selector = "a.lightbox-link",
    groupSelector = ".gallery-plates, .walkthrough",
    labels: labelsOverride = {},
  } = options;

  const labels: LightboxLabels = { ...DEFAULT_LABELS, ...labelsOverride };
  const doc = docOf(root);

  const links = [...root.querySelectorAll<HTMLAnchorElement>(selector)].filter(
    (link) => claim(link, "lightbox"),
  );

  if (links.length === 0) {
    return {
      destroy(): void {
        /* nothing this mount claimed: nothing here to tear down */
        return;
      },
    };
  }

  let refs: Refs | null = null;
  let items: Item[] = [];
  let index = 0;
  let fit = 1;
  let view: ZoomView = { zoom: 1, x: 0, y: 0 };
  let boxW = FALLBACK_BOX.w;
  let boxH = FALLBACK_BOX.h;

  const applyView = (r: Refs): void => {
    const item = items[index];
    r.img.style.width = `${String(item.w * view.zoom)}px`;
    r.img.style.height = `${String(item.h * view.zoom)}px`;
    r.img.style.transform = `translate(calc(-50% + ${String(view.x)}px), calc(-50% + ${String(view.y)}px))`;
    r.readoutEl.textContent = readout(view, fit);
    r.homeBtn.hidden = !outOfWhack(view, item.w, item.h, boxW, boxH);
  };

  const goTo = (r: Refs, i: number): void => {
    const n = items.length;
    show(r, ((i % n) + n) % n);

    r.thumbs.querySelectorAll(".lb-thumb").forEach((t, ti) => {
      t.classList.toggle("active", ti === index);

      /* The strip scrolls rather than wraps; keep the active thumb in
         view (guarded: jsdom has no scrollIntoView). */
      if (
        ti === index &&
        t instanceof HTMLElement &&
        typeof t.scrollIntoView === "function"
      ) {
        t.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    });
  };

  const buildThumbs = (r: Refs): void => {
    r.thumbs.replaceChildren();

    items.forEach((item, i) => {
      const btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "lb-thumb";
      btn.setAttribute("aria-label", labels.image(i + 1, items.length));
      const timg = doc.createElement("img");
      timg.src = item.thumb;
      timg.alt = "";
      btn.append(timg);

      btn.addEventListener("click", () => {
        goTo(r, i);
      });

      r.thumbs.append(btn);
    });
  };

  const show = (r: Refs, i: number): void => {
    index = i;
    const item = items[index];
    fit = fitZoom(item.w, item.h, boxW, boxH);
    view = initialView(item.w, item.h, boxW, boxH);
    r.caption.textContent = item.caption;
    r.img.alt = item.caption;
    r.dims.textContent = `${String(item.w)} × ${String(item.h)}`;
    r.counter.textContent = `${String(index + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
    r.img.src = item.thumb;
    swapToFull(r.img, item.href, doc);
    applyView(r);
  };

  const ensureRefs = (): Refs => {
    if (refs) return refs;
    const r = buildDialog(doc, labels);

    r.prevBtn.addEventListener("click", () => {
      goTo(r, index - 1);
    });

    r.nextBtn.addEventListener("click", () => {
      goTo(r, index + 1);
    });

    r.dialog.addEventListener("keydown", (ev) => {
      if (items.length < 2) return;
      if (ev.key === "ArrowRight") goTo(r, index + 1);
      if (ev.key === "ArrowLeft") goTo(r, index - 1);
    });

    /* Swipe navigation was removed with unbounded pan (owner adjustment
       2026-08-01): drag always pans, and set navigation is arrows, keys,
       and the scrollable thumb strip. */
    const ZOOM_STEP = 1.2;
    const item = (): Item => items[index];

    const rezoom = (factor: number, cx: number, cy: number): void => {
      view = zoomAt(view, factor, cx, cy, item().w, item().h, boxW, boxH);
      applyView(r);
    };

    /* Cursor position relative to the viewbox center. */
    const rel = (ev: MouseEvent): { cx: number; cy: number } => {
      const rect = r.viewbox.getBoundingClientRect();
      return {
        cx: ev.clientX - rect.left - (rect.width || boxW) / 2,
        cy: ev.clientY - rect.top - (rect.height || boxH) / 2,
      };
    };

    r.dialog.addEventListener("keydown", (ev) => {
      if (ev.key === "+" || ev.key === "=") rezoom(ZOOM_STEP, 0, 0);
      if (ev.key === "-") rezoom(1 / ZOOM_STEP, 0, 0);

      if (ev.key === "0") {
        view = initialView(item().w, item().h, boxW, boxH);
        applyView(r);
      }
    });

    r.homeBtn.addEventListener("click", () => {
      view = initialView(item().w, item().h, boxW, boxH);
      applyView(r);
    });

    r.viewbox.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        const { cx, cy } = rel(ev);
        rezoom(ev.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, cx, cy);
      },
      { passive: false },
    );

    /* At the untouched initial view, double-click dives to 100% under the
       cursor; from any other zoom or pan state it returns to fit, centered
       (owner adjustment 2026-08-01). */
    /* On the viewbox, not the image: pointer capture retargets the
       click pair that forms a dblclick to the capture element, so a
       listener on the image never fires in real browsers. */
    r.viewbox.addEventListener("dblclick", (ev) => {
      const init = initialView(item().w, item().h, boxW, boxH);

      const atInit =
        view.zoom === init.zoom && view.x === init.x && view.y === init.y;

      if (atInit && view.zoom < 1) {
        const { cx, cy } = rel(ev);
        rezoom(1 / view.zoom, cx, cy);
      } else {
        view = init;
        applyView(r);
      }
    });

    /* Drag pans while zoomed past fit; pinch zooms. Two live pointers
       mean pinch; one means pan (or, at fit, the Task 5 swipe). */
    const pointers = new Map<number, { x: number; y: number }>();

    r.viewbox.addEventListener("pointerdown", (ev) => {
      /* A press on HOME is a button press, not a drag. Capturing it
         would retarget the pointerup and click to the viewbox, so the
         button would never fire in real browsers (jsdom lacks capture,
         which is why only the browser showed this). */
      if (ev.target === r.homeBtn) return;
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

      if (typeof r.viewbox.setPointerCapture === "function") {
        r.viewbox.setPointerCapture(ev.pointerId);
      }
    });

    r.viewbox.addEventListener("pointermove", (ev) => {
      const prev = pointers.get(ev.pointerId);
      if (!prev) return;

      if (pointers.size === 2) {
        const other = [...pointers.entries()].find(
          ([id]) => id !== ev.pointerId,
        )?.[1];

        if (other) {
          const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
          const d1 = Math.hypot(ev.clientX - other.x, ev.clientY - other.y);

          if (d0 > 0) {
            const rect = r.viewbox.getBoundingClientRect();

            const midX =
              (ev.clientX + other.x) / 2 - rect.left - (rect.width || boxW) / 2;

            const midY =
              (ev.clientY + other.y) / 2 - rect.top - (rect.height || boxH) / 2;

            rezoom(d1 / d0, midX, midY);
          }
        }
      } else {
        view = normalizePan({
          zoom: view.zoom,
          x: view.x + ev.clientX - prev.x,
          y: view.y + ev.clientY - prev.y,
        });

        applyView(r);
      }

      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    });

    const lift = (ev: PointerEvent): void => {
      pointers.delete(ev.pointerId);
    };

    r.viewbox.addEventListener("pointerup", lift);
    r.viewbox.addEventListener("pointercancel", lift);

    refs = r;
    return r;
  };

  const open = (link: HTMLAnchorElement): void => {
    const r = ensureRefs();
    const set = setFor(link, selector, groupSelector);
    items = set.map(itemFor);
    const solo = items.length < 2;
    r.counter.hidden = solo;
    r.prevBtn.hidden = solo;
    r.nextBtn.hidden = solo;
    r.thumbs.hidden = solo;
    if (!solo) buildThumbs(r);
    r.pmOpen(link);
    const rect = r.viewbox.getBoundingClientRect();
    boxW = rect.width || FALLBACK_BOX.w;
    boxH = rect.height || FALLBACK_BOX.h;
    goTo(r, Math.max(0, set.indexOf(link)));
  };

  const mounted: {
    link: HTMLAnchorElement;
    onClick: (ev: MouseEvent) => void;
  }[] = [];

  for (const link of links) {
    const onClick = (ev: MouseEvent): void => {
      if (
        ev.defaultPrevented ||
        ev.button !== 0 ||
        ev.ctrlKey ||
        ev.metaKey ||
        ev.shiftKey ||
        ev.altKey
      ) {
        return;
      }

      ev.preventDefault();
      open(link);
    };

    link.addEventListener("click", onClick);
    mounted.push({ link, onClick });
  }

  return {
    destroy(): void {
      for (const { link, onClick } of mounted) {
        link.removeEventListener("click", onClick);
        release(link, "lightbox");
      }

      if (refs) {
        refs.dialog.remove();
        refs = null;
      }
    },
  };
};
