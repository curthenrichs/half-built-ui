import { claim, release, type Island, type IslandHandle } from "./core/island";
import { docOf } from "./core/dom";

/* Scroll-to-top floater island (step 9), born from Base.astro's inline
   script: shows once the header leaves the viewport. */

export interface ScrollTopOptions {
  buttonId?: string;
  watchId?: string;
}

export const mountScrollTop: Island<ScrollTopOptions> = (
  root,
  options = {},
): IslandHandle => {
  const { buttonId = "scroll-to-top", watchId = "masthead" } = options;
  const doc = docOf(root);
  // Scroll-to-top floater: shows once the header leaves the viewport.
  const toTop = doc.getElementById(buttonId);
  const masthead = doc.getElementById(watchId);
  let observer: IntersectionObserver | null = null;

  if (toTop && masthead && claim(toTop, "scroll-top")) {
    observer = new IntersectionObserver(([entry]) => {
      toTop.classList.toggle("show", !entry.isIntersecting);
    });

    observer.observe(masthead);
  }

  return {
    destroy(): void {
      observer?.disconnect();
      if (toTop && observer) release(toTop, "scroll-top");
    },
  };
};
