// @vitest-environment jsdom
/* DOM runtime tests for the lightbox decorator, in the manner of
   code-island-dom.test.ts. Fixture markup mirrors the built output of
   the content components (BlogImage, Gallery, Walkthrough/Step). */
import { describe, it, expect, beforeEach } from "vitest";
import {
  mountLightbox,
  swapToFull,
  FALLBACK_BOX,
} from "../src/scripts/lightbox";
import { polyfillDialog } from "./helpers";

const PAGE = `
  <main class="prose">
    <figure class="blog-image">
      <a class="lightbox-link" href="/full/solo.jpg" data-lb-w="1600" data-lb-h="1200" data-lb-caption="A solo figure">
        <img src="/thumb/solo.jpg" alt="A solo figure">
      </a>
    </figure>
    <figure class="blog-image tall-image">
      <a class="lightbox-link" href="/full/tall.jpg" data-lb-w="1000" data-lb-h="4000" data-lb-caption="A tall schematic">
        <img src="/thumb/tall.jpg" alt="A tall schematic">
      </a>
    </figure>
    <div class="gallery-plates bracket-frame">
      <figure class="gallery-plate"><div class="plate-frame">
        <a class="lightbox-link" href="/full/g1.jpg" data-lb-w="2000" data-lb-h="1500" data-lb-caption="Plate one"><img src="/thumb/g1.jpg" alt="Plate one"></a>
      </div></figure>
      <figure class="gallery-plate"><div class="plate-frame">
        <a class="lightbox-link" href="/full/g2.jpg" data-lb-w="2000" data-lb-h="1500" data-lb-caption="Plate two"><img src="/thumb/g2.jpg" alt="Plate two"></a>
      </div></figure>
      <figure class="gallery-plate"><div class="plate-frame">
        <a class="lightbox-link" href="/full/g3.jpg" data-lb-w="1500" data-lb-h="2000" data-lb-caption="Plate three"><img src="/thumb/g3.jpg" alt="Plate three"></a>
      </div></figure>
    </div>
    <ol class="walkthrough">
      <li class="step"><div class="step-media">
        <a class="lightbox-link" href="/full/w1.jpg" data-lb-w="1928" data-lb-h="2560" data-lb-caption="Step one"><img src="/thumb/w1.jpg" alt="Step one"></a>
      </div><div class="step-body"><p>One</p></div></li>
      <li class="step"><div class="step-media">
        <a class="lightbox-link" href="/full/w2a.jpg" data-lb-w="1440" data-lb-h="2560" data-lb-caption="Step two, front"><img src="/thumb/w2a.jpg" alt="Step two, front"></a>
        <a class="lightbox-link" href="/full/w2b.jpg" data-lb-w="1440" data-lb-h="2560" data-lb-caption="Step two, back"><img src="/thumb/w2b.jpg" alt="Step two, back"></a>
      </div><div class="step-body"><p>Two</p></div></li>
    </ol>
    <ol class="walkthrough">
      <li class="step"><div class="step-media">
        <a class="lightbox-link" href="/full/w3.jpg" data-lb-w="2560" data-lb-h="1440" data-lb-caption="Other walkthrough"><img src="/thumb/w3.jpg" alt="Other walkthrough"></a>
      </div><div class="step-body"><p>Three</p></div></li>
    </ol>
  </main>`;

function openViaClick(selector: string): void {
  const link = document.querySelector<HTMLAnchorElement>(selector);
  if (!link) throw new Error(`no link for ${selector}`);

  link.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true }),
  );
}

const dialog = (): HTMLDialogElement => {
  const d = document.querySelector<HTMLDialogElement>("dialog.lb-dialog");
  if (!d) throw new Error("dialog not built");
  return d;
};

beforeEach(() => {
  polyfillDialog();
  document.body.innerHTML = PAGE;
  mountLightbox(document);
});

describe("open and close", () => {
  it("builds no dialog until first use", () => {
    expect(document.querySelector("dialog.lb-dialog")).toBeNull();
  });

  it("click opens the modal and prevents navigation", () => {
    openViaClick(".blog-image a.lightbox-link");
    expect(dialog().hasAttribute("open")).toBe(true);
  });

  it("close button closes and focus returns to the opening link", () => {
    openViaClick(".blog-image a.lightbox-link");
    dialog().querySelector<HTMLButtonElement>(".lb-close")?.click();
    expect(dialog().hasAttribute("open")).toBe(false);

    expect(document.activeElement).toBe(
      document.querySelector(".blog-image a.lightbox-link"),
    );
  });

  it("veil click closes; clicks inside the zone do not", () => {
    openViaClick(".blog-image a.lightbox-link");

    dialog()
      .querySelector(".lb-plate")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(dialog().hasAttribute("open")).toBe(true);
    dialog().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dialog().hasAttribute("open")).toBe(false);
  });

  it("reuses one dialog across opens", () => {
    openViaClick(".blog-image a.lightbox-link");
    dialog().close();
    openViaClick(".gallery-plates a.lightbox-link");
    expect(document.querySelectorAll("dialog.lb-dialog").length).toBe(1);
  });
});

describe("solo mode", () => {
  it("shows caption, dims, and readout; hides counter, arrows, thumbs", () => {
    openViaClick(".blog-image a.lightbox-link");
    const d = dialog();
    expect(d.querySelector(".lb-caption")?.textContent).toBe("A solo figure");
    expect(d.querySelector(".lb-dims")?.textContent).toBe("1600 × 1200");
    expect(d.querySelector(".lb-readout")?.textContent).toBe("FIT · 0,0");
    expect(d.querySelector<HTMLElement>(".lb-counter")?.hidden).toBe(true);
    expect(d.querySelector<HTMLElement>(".lb-prev")?.hidden).toBe(true);
    expect(d.querySelector<HTMLElement>(".lb-next")?.hidden).toBe(true);
    expect(d.querySelector<HTMLElement>(".lb-thumbs")?.hidden).toBe(true);
  });

  it("sizes the image from the fallback box when rects measure zero", () => {
    openViaClick(".blog-image a.lightbox-link");
    // 1600x1200 in the 800x600 fallback box: fit 0.5, so width 800px
    const img = dialog().querySelector<HTMLImageElement>(".lb-img");

    expect(img?.style.width).toBe(
      `${String(1600 * (FALLBACK_BOX.w / 1600))}px`,
    );
  });
});

describe("full-resolution swap", () => {
  it("shows the in-page rendition immediately, swaps when the original loads", () => {
    const target = document.createElement("img");
    target.src = "/thumb/solo.jpg";
    const probe = swapToFull(target, "/full/solo.jpg", document);
    expect(probe).not.toBeNull();
    expect(target.src).toContain("/thumb/solo.jpg");
    probe?.dispatchEvent(new Event("load"));
    expect(target.src).toContain("/full/solo.jpg");
  });

  it("ignores a stale load after navigating away", () => {
    const target = document.createElement("img");
    target.src = "/thumb/g1.jpg";
    const probe = swapToFull(target, "/full/g1.jpg", document);
    target.dataset.pending = "/full/g2.jpg";
    probe?.dispatchEvent(new Event("load"));
    expect(target.src).toContain("/thumb/g1.jpg");
  });
});

describe("gallery sets", () => {
  beforeEach(() => {
    openViaClick(".gallery-plates a.lightbox-link");
  });

  it("shows counter, arrows, and one thumb per plate", () => {
    const d = dialog();
    expect(d.querySelector(".lb-counter")?.textContent).toBe("01 / 03");
    expect(d.querySelector<HTMLElement>(".lb-prev")?.hidden).toBe(false);
    expect(d.querySelectorAll(".lb-thumb").length).toBe(3);

    expect(
      d.querySelectorAll(".lb-thumb")[0].classList.contains("active"),
    ).toBe(true);
  });

  it("next advances with wrap-around and updates caption + active thumb", () => {
    const d = dialog();
    const next = d.querySelector<HTMLButtonElement>(".lb-next");
    next?.click();
    expect(d.querySelector(".lb-counter")?.textContent).toBe("02 / 03");
    expect(d.querySelector(".lb-caption")?.textContent).toBe("Plate two");
    next?.click();
    next?.click();
    expect(d.querySelector(".lb-counter")?.textContent).toBe("01 / 03");

    expect(
      d.querySelectorAll(".lb-thumb")[0].classList.contains("active"),
    ).toBe(true);
  });

  it("arrow keys navigate", () => {
    const d = dialog();

    d.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );

    expect(d.querySelector(".lb-counter")?.textContent).toBe("02 / 03");

    d.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );

    expect(d.querySelector(".lb-counter")?.textContent).toBe("01 / 03");
  });

  it("clicking a thumb jumps to that image", () => {
    const d = dialog();
    d.querySelectorAll<HTMLButtonElement>(".lb-thumb")[2].click();
    expect(d.querySelector(".lb-caption")?.textContent).toBe("Plate three");
  });

  it("solo images ignore arrow keys", () => {
    dialog().close();
    openViaClick(".blog-image a.lightbox-link");
    const d = dialog();

    d.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );

    expect(d.querySelector(".lb-caption")?.textContent).toBe("A solo figure");
  });

  it("a two-finger pinch does not trigger swipe navigation on release", () => {
    const d = dialog();
    const viewbox = d.querySelector(".lb-viewbox");

    /* jsdom lacks a PointerEvent constructor (see henry-loose-dom.test.ts);
       dispatch MouseEvents typed as pointer events and attach pointerId,
       the only pointer-specific field the listeners read. */
    const pointer = (
      type: string,
      pointerId: number,
      x: number,
      y: number,
    ): Event => {
      const ev = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      });

      Object.defineProperty(ev, "pointerId", { value: pointerId });
      return ev;
    };

    viewbox?.dispatchEvent(pointer("pointerdown", 1, 300, 300));
    viewbox?.dispatchEvent(pointer("pointerdown", 2, 700, 300));
    viewbox?.dispatchEvent(pointer("pointermove", 1, 380, 300));
    viewbox?.dispatchEvent(pointer("pointermove", 2, 600, 300));
    viewbox?.dispatchEvent(pointer("pointerup", 1, 380, 300));
    viewbox?.dispatchEvent(pointer("pointerup", 2, 600, 300));
    expect(d.querySelector(".lb-counter")?.textContent).toBe("01 / 03");
    expect(d.querySelector(".lb-caption")?.textContent).toBe("Plate one");
  });
});

describe("walkthrough sets", () => {
  it("every photo in one walkthrough forms a set, across steps and multi-photo cells", () => {
    openViaClick(".walkthrough a.lightbox-link");
    const d = dialog();
    expect(d.querySelector(".lb-counter")?.textContent).toBe("01 / 03");
    expect(d.querySelectorAll(".lb-thumb").length).toBe(3);
    d.querySelector<HTMLButtonElement>(".lb-next")?.click();
    d.querySelector<HTMLButtonElement>(".lb-next")?.click();
    expect(d.querySelector(".lb-caption")?.textContent).toBe("Step two, back");
  });

  it("a second walkthrough is its own set, not chained to the first", () => {
    openViaClick('a.lightbox-link[href="/full/w3.jpg"]');
    const d = dialog();
    expect(d.querySelector<HTMLElement>(".lb-prev")?.hidden).toBe(true);
    expect(d.querySelector<HTMLElement>(".lb-next")?.hidden).toBe(true);
  });

  it("gallery and walkthrough sets do not see each other", () => {
    openViaClick(".gallery-plates a.lightbox-link");
    expect(dialog().querySelectorAll(".lb-thumb").length).toBe(3);
  });
});

describe("zoom and pan interactions", () => {
  beforeEach(() => {
    openViaClick(".blog-image a.lightbox-link");
  });

  it("plus and minus keys zoom around center; 0 returns to fit", () => {
    const d = dialog();
    const out = (): string => d.querySelector(".lb-readout")?.textContent ?? "";
    expect(out()).toBe("FIT · 0,0");
    d.dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true }));
    // 1600x1200 in the 800x600 fallback box: fit 0.5; one step is x1.2
    expect(out()).toBe("60% · +0,+0");
    d.dispatchEvent(new KeyboardEvent("keydown", { key: "0", bubbles: true }));
    expect(out()).toBe("FIT · 0,0");
    d.dispatchEvent(new KeyboardEvent("keydown", { key: "-", bubbles: true }));
    // below fit: clamped pan keeps it centered on the mat
    expect(out()).toBe("42% · +0,+0");
  });

  it("double-click toggles between fit and 100%", () => {
    const d = dialog();
    const img = d.querySelector<HTMLImageElement>(".lb-img");

    img?.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, clientX: 0, clientY: 0 }),
    );

    expect(d.querySelector(".lb-readout")?.textContent).toContain("100%");

    img?.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, clientX: 0, clientY: 0 }),
    );

    expect(d.querySelector(".lb-readout")?.textContent).toBe("FIT · 0,0");
  });

  it("double-click from any non-initial state returns to fit, centered", () => {
    const d = dialog();
    const out = (): string => d.querySelector(".lb-readout")?.textContent ?? "";
    d.dispatchEvent(new KeyboardEvent("keydown", { key: "+", bubbles: true }));
    expect(out()).toBe("60% · +0,+0");
    const img = d.querySelector<HTMLImageElement>(".lb-img");

    img?.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, clientX: 0, clientY: 0 }),
    );

    expect(out()).toBe("FIT · 0,0");
  });

  it("suppresses native image dragging so drag pans instead", () => {
    const d = dialog();
    const img = d.querySelector<HTMLImageElement>(".lb-img");
    expect(img?.draggable).toBe(false);
    const drag = new Event("dragstart", { bubbles: true, cancelable: true });
    img?.dispatchEvent(drag);
    expect(drag.defaultPrevented).toBe(true);
  });

  it("wheel zooms in and updates the image size", () => {
    const d = dialog();
    const img = d.querySelector<HTMLImageElement>(".lb-img");
    const before = img?.style.width;

    d.querySelector(".lb-viewbox")?.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -100,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(img?.style.width).not.toBe(before);
    expect(d.querySelector(".lb-readout")?.textContent).toContain("%");
  });
});

describe("pan on tall images", () => {
  const pointer = (
    type: string,
    pointerId: number,
    x: number,
    y: number,
  ): Event => {
    const ev = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    });

    Object.defineProperty(ev, "pointerId", { value: pointerId });
    return ev;
  };

  it("pans vertically at the initial fit-width view, without zooming first", () => {
    openViaClick(".tall-image a.lightbox-link");
    const d = dialog();
    const out = (): string => d.querySelector(".lb-readout")?.textContent ?? "";
    // 1000x4000 in the 800x600 fallback box: fit-width zoom 0.8,
    // y = (4000*0.8 - 600) / 2 = 1300, so it opens scrolled to the top.
    expect(out()).toBe("FIT · +0,+1300");
    const viewbox = d.querySelector(".lb-viewbox");
    viewbox?.dispatchEvent(pointer("pointerdown", 1, 300, 500));
    // Drag upward (negative clientY delta): reveals more of the bottom,
    // so y should decrease from the top-scrolled 1300.
    viewbox?.dispatchEvent(pointer("pointermove", 1, 300, 400));
    expect(out()).toBe("FIT · +0,+1200");
  });
});

describe("free pan world", () => {
  const pointer = (
    type: string,
    pointerId: number,
    x: number,
    y: number,
  ): Event => {
    const ev = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
    });

    Object.defineProperty(ev, "pointerId", { value: pointerId });
    return ev;
  };

  it("pans at fit and keeps going past the old edge-stop bounds", () => {
    openViaClick(".blog-image a.lightbox-link");
    const d = dialog();
    const out = (): string => d.querySelector(".lb-readout")?.textContent ?? "";
    expect(out()).toBe("FIT · 0,0");
    const viewbox = d.querySelector(".lb-viewbox");
    viewbox?.dispatchEvent(pointer("pointerdown", 1, 400, 300));
    viewbox?.dispatchEvent(pointer("pointermove", 1, 600, 300));
    expect(out()).toBe("FIT · +200,+0");
    // 1600x1200 at fit 0.5 exactly fills the 800x600 fallback box; the
    // old clamp pinned x to 0. Free drag sails past it.
    viewbox?.dispatchEvent(pointer("pointermove", 1, 1300, 260));
    expect(out()).toBe("FIT · +900,-40");
  });

  it("HOME button appears when the view is out of whack and resets it", () => {
    openViaClick(".blog-image a.lightbox-link");
    const d = dialog();
    const home = d.querySelector<HTMLButtonElement>(".lb-home");
    expect(home?.hidden).toBe(true);
    const viewbox = d.querySelector(".lb-viewbox");
    viewbox?.dispatchEvent(pointer("pointerdown", 1, 400, 300));
    viewbox?.dispatchEvent(pointer("pointermove", 1, 1100, 300));
    expect(d.querySelector(".lb-readout")?.textContent).toBe("FIT · +700,+0");
    expect(home?.hidden).toBe(false);
    home?.click();
    expect(d.querySelector(".lb-readout")?.textContent).toBe("FIT · 0,0");
    expect(home?.hidden).toBe(true);
  });

  it("a press starting on HOME never drags the world", () => {
    openViaClick(".blog-image a.lightbox-link");
    const d = dialog();
    const out = (): string => d.querySelector(".lb-readout")?.textContent ?? "";
    const viewbox = d.querySelector(".lb-viewbox");
    viewbox?.dispatchEvent(pointer("pointerdown", 1, 400, 300));
    viewbox?.dispatchEvent(pointer("pointermove", 1, 1100, 300));
    viewbox?.dispatchEvent(pointer("pointerup", 1, 1100, 300));
    expect(out()).toBe("FIT · +700,+0");
    const home = d.querySelector<HTMLButtonElement>(".lb-home");
    expect(home?.hidden).toBe(false);
    home?.dispatchEvent(pointer("pointerdown", 2, 420, 560));
    viewbox?.dispatchEvent(pointer("pointermove", 2, 460, 560));
    expect(out()).toBe("FIT · +700,+0");
  });

  it("horizontal swipe no longer navigates the set; thumbs do", () => {
    openViaClick(".gallery-plates a.lightbox-link");
    const d = dialog();
    const viewbox = d.querySelector(".lb-viewbox");
    viewbox?.dispatchEvent(pointer("pointerdown", 1, 500, 300));
    viewbox?.dispatchEvent(pointer("pointermove", 1, 380, 305));
    viewbox?.dispatchEvent(pointer("pointerup", 1, 380, 305));
    expect(d.querySelector(".lb-counter")?.textContent).toBe("01 / 03");
    d.querySelectorAll<HTMLButtonElement>(".lb-thumb")[1].click();
    expect(d.querySelector(".lb-counter")?.textContent).toBe("02 / 03");
  });
});

describe("modified clicks fall through to the browser", () => {
  it("does not open the lightbox on a ctrl-click", () => {
    const link = document.querySelector<HTMLAnchorElement>(
      ".blog-image a.lightbox-link",
    );

    link?.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
      }),
    );

    expect(document.querySelector("dialog.lb-dialog")).toBeNull();
  });

  it("does not open the lightbox on a non-primary-button click", () => {
    const link = document.querySelector<HTMLAnchorElement>(
      ".blog-image a.lightbox-link",
    );

    link?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, button: 1 }),
    );

    expect(document.querySelector("dialog.lb-dialog")).toBeNull();
  });

  it("still opens on a plain primary click", () => {
    openViaClick(".blog-image a.lightbox-link");
    expect(dialog().hasAttribute("open")).toBe(true);
  });
});

describe("island lifecycle (step 9)", () => {
  it("mounting twice on the same fixture still builds one dialog", () => {
    document.body.innerHTML = PAGE;
    mountLightbox(document);
    mountLightbox(document);
    openViaClick(".blog-image a.lightbox-link");
    expect(document.querySelectorAll("dialog.lb-dialog").length).toBe(1);
  });

  it("destroy removes the dialog; a click on a link after destroy does not reopen it", () => {
    document.body.innerHTML = PAGE;
    const handle = mountLightbox(document);
    openViaClick(".blog-image a.lightbox-link");
    expect(document.querySelector("dialog.lb-dialog")).not.toBeNull();
    handle.destroy();
    expect(document.querySelector("dialog.lb-dialog")).toBeNull();
    openViaClick(".blog-image a.lightbox-link");
    expect(document.querySelector("dialog.lb-dialog")).toBeNull();
  });

  it("a custom viewer label lands on the dialog's aria-label", () => {
    document.body.innerHTML = PAGE;
    mountLightbox(document, { labels: { viewer: "Custom viewer" } });
    openViaClick(".blog-image a.lightbox-link");
    expect(dialog().getAttribute("aria-label")).toBe("Custom viewer");
  });
});

describe("custom selector grouping (step 9.5)", () => {
  const CUSTOM = `
    <main>
      <div class="gallery-plates">
        <a class="shot" href="/full/c1.jpg" data-lb-w="1600" data-lb-h="1200" data-lb-caption="One"><img src="/thumb/c1.jpg" alt="One"></a>
        <a class="shot" href="/full/c2.jpg" data-lb-w="1600" data-lb-h="1200" data-lb-caption="Two"><img src="/thumb/c2.jpg" alt="Two"></a>
      </div>
      <div class="strip">
        <a class="shot" href="/full/s1.jpg" data-lb-w="1600" data-lb-h="1200" data-lb-caption="S one"><img src="/thumb/s1.jpg" alt="S one"></a>
        <a class="shot" href="/full/s2.jpg" data-lb-w="1600" data-lb-h="1200" data-lb-caption="S two"><img src="/thumb/s2.jpg" alt="S two"></a>
      </div>
    </main>`;

  beforeEach(() => {
    document.body.innerHTML = CUSTOM;
    mountLightbox(document, { selector: "a.shot" });
  });

  it("an overridden selector still forms sets inside the default group containers", () => {
    openViaClick(".gallery-plates a.shot");

    expect(dialog().querySelector<HTMLElement>(".lb-counter")?.hidden).toBe(
      false,
    );
  });

  it("groupSelector extends grouping to a container the defaults do not know", () => {
    document.body.innerHTML = CUSTOM;

    mountLightbox(document, {
      selector: "a.shot",
      groupSelector: ".gallery-plates, .strip",
    });

    openViaClick(".strip a.shot");

    expect(dialog().querySelector<HTMLElement>(".lb-counter")?.hidden).toBe(
      false,
    );
  });
});
