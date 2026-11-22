import { claim, release, type Island, type IslandHandle } from "./core/island";

/* Image loading state. While an image downloads, its frame carries
   data-loading and a "$> Loading..." label (the look lives in the
   img-loading pattern in patterns.css). The script, never the server,
   sets the mark: without JS a frame renders exactly as a bare image
   would, with no label stranded over a finished picture. The mark
   clears on error too, so a broken image falls back to its alt text.
   The lightbox reuses watchImage on its viewbox. */

export function buildLoadingLabel(doc: Document): HTMLSpanElement {
  const label = doc.createElement("span");
  label.className = "img-loading";
  label.setAttribute("aria-hidden", "true");
  const prompt = doc.createElement("span");
  prompt.className = "img-loading-prompt";
  prompt.textContent = "$>";
  /* Three dot spans step their visibility in CSS, so all three always
     hold their space and the line never re-centers as they fill. */
  const dots = doc.createElement("span");
  dots.className = "img-loading-dots";

  for (let i = 0; i < 3; i++) {
    const dot = doc.createElement("i");
    dot.textContent = ".";
    dots.append(dot);
  }

  label.append(prompt, "Loading", dots);
  return label;
}

/* An image that arrives within the grace period (a cache hit takes
   tens of milliseconds, and the island often runs before it lands)
   never shows the state at all. The fade matches the patterns.css
   transitions; the label leaves the DOM once it has faded, so no
   finished image keeps hidden text or running dot animations. */
export const LOADING_GRACE_MS = 150;
export const LOADING_FADE_MS = 350;

/* One live watch per frame: a new watch (the lightbox reuses its
   viewbox for every item) cancels the old one's listeners and timers. */
const watches = new WeakMap<HTMLElement, AbortController>();

export function watchImage(frame: HTMLElement, img: HTMLImageElement): void {
  watches.get(frame)?.abort();
  const watch = new AbortController();
  watches.set(frame, watch);
  const { signal } = watch;
  const label = frame.querySelector(":scope > .img-loading");

  if (img.complete) {
    delete frame.dataset.loading;
    label?.remove();
    return;
  }

  /* In place before the mark, so the mark fades it in rather than
     inserting it at full strength. */
  if (!label) frame.append(buildLoadingLabel(frame.ownerDocument));
  const win = frame.ownerDocument.defaultView ?? window;

  const grace = win.setTimeout(() => {
    if (!img.complete) frame.dataset.loading = "";
  }, LOADING_GRACE_MS);

  const clear = (): void => {
    win.clearTimeout(grace);
    delete frame.dataset.loading;

    const fade = win.setTimeout(() => {
      frame.querySelector(":scope > .img-loading")?.remove();
    }, LOADING_FADE_MS);

    signal.addEventListener("abort", () => {
      win.clearTimeout(fade);
    });
  };

  signal.addEventListener("abort", () => {
    win.clearTimeout(grace);
  });

  img.addEventListener("load", clear, { once: true, signal });
  img.addEventListener("error", clear, { once: true, signal });
}

export const mountImageLoading: Island = (root): IslandHandle => {
  const claimed: HTMLElement[] = [];

  for (const frame of root.querySelectorAll<HTMLElement>(".img-frame")) {
    const img = frame.querySelector("img");
    if (!img || !claim(frame, "img-loading")) continue;
    claimed.push(frame);
    watchImage(frame, img);
  }

  return {
    destroy(): void {
      for (const frame of claimed) release(frame, "img-loading");
    },
  };
};
