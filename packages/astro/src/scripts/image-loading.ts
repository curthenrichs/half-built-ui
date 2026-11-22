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

/* A superseded watch needs no cleanup: the browser abandons the old
   request, so its load never fires, and once-listeners left behind are
   consumed by the next load harmlessly. */
export function watchImage(frame: HTMLElement, img: HTMLImageElement): void {
  if (img.complete) {
    delete frame.dataset.loading;
    return;
  }

  if (!frame.querySelector(":scope > .img-loading")) {
    frame.append(buildLoadingLabel(frame.ownerDocument));
  }

  frame.dataset.loading = "";

  const clear = (): void => {
    delete frame.dataset.loading;
  };

  img.addEventListener("load", clear, { once: true });
  img.addEventListener("error", clear, { once: true });
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
