// @vitest-environment jsdom
/* DOM tests for the plate frame's enlarge box (scripts/plate-frame.ts):
   the content moves onto the plate modal whole and comes back on every
   way out, with a same-height slot holding its place and focus returned
   to the corner box. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountPlateFrames } from "../src/scripts/plate-frame";
import { polyfillDialog } from "./helpers";

const FRAME = `
  <div class="plate-frame" data-plate-label="Sample view" data-plate-class="wide-plate" data-zone-class="wide-zone">
    <div class="plate-frame-plate bracket-frame">
      <button type="button" class="icon-box plate-frame-corner">enlarge</button>
      <div data-plate-frame-content><p>live content</p></div>
    </div>
  </div>`;

function q<T extends Element>(sel: string, kind: new () => T): T {
  const el = document.querySelector(sel);
  if (!(el instanceof kind)) throw new Error(`missing ${sel}`);
  return el;
}

describe("mountPlateFrames", () => {
  let handle: { destroy(): void };

  beforeEach(() => {
    polyfillDialog();
    document.body.innerHTML = FRAME;
    handle = mountPlateFrames(document);
  });

  afterEach(() => {
    handle.destroy();
    document.body.innerHTML = "";
  });

  const parts = () => ({
    frame: q(".plate-frame", HTMLElement),
    btn: q(".plate-frame-corner", HTMLButtonElement),
    content: q("[data-plate-frame-content]", HTMLElement),
  });

  it("moves the content onto the plate modal whole and marks the frame popped", () => {
    const { frame, btn, content } = parts();
    btn.click();

    const dialog = q("dialog", HTMLDialogElement);
    expect(dialog.open).toBe(true);
    expect(dialog.getAttribute("aria-label")).toBe("Sample view");
    expect(content.closest(".pm-plate")).not.toBeNull();
    expect(frame.contains(content)).toBe(false);
    expect(frame.classList.contains("is-popped")).toBe(true);
  });

  it("adds the frame's plate and zone classes to the modal", () => {
    parts().btn.click();

    expect(q(".pm-plate", HTMLElement).classList.contains("wide-plate")).toBe(
      true,
    );

    expect(q(".pm-zone", HTMLElement).classList.contains("wide-zone")).toBe(
      true,
    );
  });

  it("puts the content back on close and refocuses the corner box", () => {
    const { frame, btn, content } = parts();
    btn.click();
    q("dialog", HTMLDialogElement).close();

    expect(frame.contains(content)).toBe(true);
    expect(frame.classList.contains("is-popped")).toBe(false);
    expect(document.activeElement).toBe(btn);
  });

  it("builds the plate once and reuses it", () => {
    const { btn } = parts();
    btn.click();
    q("dialog", HTMLDialogElement).close();
    btn.click();

    expect(document.querySelectorAll("dialog")).toHaveLength(1);
  });

  it("defaults the dialog's name when the frame gives none", () => {
    handle.destroy();

    document.body.innerHTML = FRAME.replace(
      ' data-plate-label="Sample view"',
      "",
    );

    handle = mountPlateFrames(document);
    q(".plate-frame-corner", HTMLButtonElement).click();

    expect(q("dialog", HTMLDialogElement).getAttribute("aria-label")).toBe(
      "Enlarged view",
    );
  });

  it("ignores a frame with no content element", () => {
    handle.destroy();

    document.body.innerHTML = `<div class="plate-frame"><button class="plate-frame-corner"></button></div>`;

    handle = mountPlateFrames(document);
    q(".plate-frame-corner", HTMLButtonElement).click();
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("destroy closes an open modal, restores the content, and removes the dialog", () => {
    const { frame, btn, content } = parts();
    btn.click();
    handle.destroy();

    expect(frame.contains(content)).toBe(true);
    expect(document.querySelector("dialog")).toBeNull();
    handle = mountPlateFrames(document);
  });
});
