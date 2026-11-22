// @vitest-environment jsdom
/* DOM runtime test for the image loading island: SmartImage's
   .img-frame gets a "$> Loading..." label and a data-loading mark while
   its image downloads, cleared on load or error. jsdom never fetches
   images, so each test pins img.complete by hand. */
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildLoadingLabel,
  mountImageLoading,
  watchImage,
} from "../src/scripts/image-loading";

function setComplete(img: HTMLImageElement, complete: boolean): void {
  Object.defineProperty(img, "complete", {
    value: complete,
    configurable: true,
  });
}

function frameWith(complete: boolean): {
  frame: HTMLElement;
  img: HTMLImageElement;
} {
  document.body.innerHTML = `<span class="img-frame"><img src="/a.jpg" alt="A gearbox"></span>`;
  const frame = document.querySelector<HTMLElement>(".img-frame");
  const img = document.querySelector<HTMLImageElement>(".img-frame img");
  if (!frame || !img) throw new Error("fixture missing");
  setComplete(img, complete);
  return { frame, img };
}

const labels = (frame: HTMLElement) => frame.querySelectorAll(".img-loading");

describe("image loading island (DOM runtime)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("builds the label as prompt, word, and three dot spans", () => {
    const label = buildLoadingLabel(document);
    expect(label.getAttribute("aria-hidden")).toBe("true");
    expect(label.querySelector(".img-loading-prompt")?.textContent).toBe("$>");
    expect(label.querySelectorAll(".img-loading-dots i").length).toBe(3);
    expect(label.textContent).toBe("$>Loading...");
  });

  it("marks an incomplete image loading and appends one aria-hidden label", () => {
    const { frame } = frameWith(false);
    mountImageLoading(document);
    expect(frame.hasAttribute("data-loading")).toBe(true);
    expect(labels(frame).length).toBe(1);
    expect(labels(frame)[0].textContent).toBe("$>Loading...");
    expect(labels(frame)[0].getAttribute("aria-hidden")).toBe("true");
  });

  it("load clears the loading mark", () => {
    const { frame, img } = frameWith(false);
    mountImageLoading(document);
    img.dispatchEvent(new Event("load"));
    expect(frame.hasAttribute("data-loading")).toBe(false);
  });

  it("error clears the loading mark so alt text shows", () => {
    const { frame, img } = frameWith(false);
    mountImageLoading(document);
    img.dispatchEvent(new Event("error"));
    expect(frame.hasAttribute("data-loading")).toBe(false);
  });

  it("a complete image never gets the loading mark or a label", () => {
    const { frame } = frameWith(true);
    mountImageLoading(document);
    expect(frame.hasAttribute("data-loading")).toBe(false);
    expect(labels(frame).length).toBe(0);
  });

  it("mounting twice leaves one label", () => {
    const { frame } = frameWith(false);
    mountImageLoading(document);
    mountImageLoading(document);
    expect(labels(frame).length).toBe(1);
  });

  it("re-watching a frame for a new src keeps one label", () => {
    const { frame, img } = frameWith(false);
    watchImage(frame, img);
    img.src = "/b.jpg";
    watchImage(frame, img);
    expect(frame.hasAttribute("data-loading")).toBe(true);
    expect(labels(frame).length).toBe(1);
  });

  it("destroy releases the claim so a later mount watches again", () => {
    const { frame } = frameWith(false);
    mountImageLoading(document).destroy();
    expect(frame.hasAttribute("data-island-img-loading")).toBe(false);
  });
});
