/* The image loading state, pinned on for the demo. A real frame clears
   the moment its image arrives, so the specimen is a frame with no
   image: mountImageLoading skips it (it watches only frames holding an
   img), and this marks it loading with the package's own label. */
import { buildLoadingLabel } from "@half-built/astro/scripts/image-loading.ts";

export function mountLoadingDemo(doc: Document): void {
  for (const frame of doc.querySelectorAll<HTMLElement>(".demo-img-loading")) {
    if (frame.querySelector(".img-loading")) continue;
    frame.append(buildLoadingLabel(doc));
    frame.dataset.loading = "";
  }
}
