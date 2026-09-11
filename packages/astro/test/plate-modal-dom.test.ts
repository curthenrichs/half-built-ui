// @vitest-environment jsdom
/* DOM tests for the shared plate-modal chrome, in the manner of
   lightbox-dom.test.ts. */
import { describe, it, expect, beforeEach } from "vitest";
import { buildPlateModal } from "../src/scripts/plate-modal";
import { polyfillDialog } from "./helpers";

describe("buildPlateModal", () => {
  beforeEach(() => {
    polyfillDialog();
    document.body.innerHTML = "<button id='opener'>open</button>";
  });

  it("builds the skeleton: dialog, zone, four corners, plate, close", () => {
    const refs = buildPlateModal(document, { ariaLabel: "Test modal" });
    expect(refs.dialog.classList.contains("pm-dialog")).toBe(true);
    expect(refs.dialog.getAttribute("aria-label")).toBe("Test modal");
    expect(refs.zone.classList.contains("pm-zone")).toBe(true);
    expect(refs.zone.querySelectorAll(".pm-corner").length).toBe(4);
    expect(refs.plate.classList.contains("pm-plate")).toBe(true);
    expect(refs.plate.classList.contains("bracket-frame")).toBe(true);
    expect(refs.closeBtn.classList.contains("pm-close")).toBe(true);
    expect(document.body.contains(refs.dialog)).toBe(true);
  });

  it("legacyPrefix doubles every skeleton class", () => {
    const refs = buildPlateModal(document, {
      ariaLabel: "x",
      legacyPrefix: "lb",
    });

    expect(refs.dialog.classList.contains("pm-dialog")).toBe(true);
    expect(refs.dialog.classList.contains("lb-dialog")).toBe(true);
    expect(refs.zone.classList.contains("lb-zone")).toBe(true);
    expect(refs.zone.querySelector(".lb-corner.lb-c-tl")).not.toBeNull();
    expect(refs.plate.classList.contains("lb-plate")).toBe(true);
    expect(refs.closeBtn.classList.contains("lb-close")).toBe(true);
  });

  it("addLabel positions and extra classes", () => {
    const refs = buildPlateModal(document, { ariaLabel: "x" });
    const l = refs.addLabel("bottomRight", "my-readout");
    expect(l.classList.contains("pm-label")).toBe(true);
    expect(l.classList.contains("pm-label-br")).toBe(true);
    expect(l.classList.contains("boxed-label")).toBe(true);
    expect(l.classList.contains("my-readout")).toBe(true);
    expect(refs.plate.contains(l)).toBe(true);
  });

  it("open records the opener and close refocuses it", () => {
    const refs = buildPlateModal(document, { ariaLabel: "x" });
    const opener = document.querySelector<HTMLButtonElement>("#opener");
    if (!opener) throw new Error("no opener");
    opener.focus();
    refs.open(opener);
    expect(refs.dialog.hasAttribute("open")).toBe(true);
    refs.close();
    expect(refs.dialog.hasAttribute("open")).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it("close button closes; veil click (outside zone) closes", () => {
    const refs = buildPlateModal(document, { ariaLabel: "x" });
    refs.open(null);
    refs.closeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(refs.dialog.hasAttribute("open")).toBe(false);
    refs.open(null);
    refs.dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(refs.dialog.hasAttribute("open")).toBe(false);
  });

  /* Regression (2026-08-23): the veil check must judge by identity, not
     zone.contains. A plate button whose handler swaps its own innerHTML
     detaches the click's target mid-bubble; a detached node is contained
     by nothing, which a containment check misreads as a veil click. */
  it("a click whose target is detached mid-bubble is not a veil click", () => {
    const refs = buildPlateModal(document, { ariaLabel: "x" });
    const btn = document.createElement("button");
    const inner = document.createElement("span");
    btn.append(inner);

    btn.addEventListener("click", () => {
      btn.innerHTML = "swapped";
    });

    refs.plate.append(btn);
    refs.open(null);
    inner.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(refs.dialog.hasAttribute("open")).toBe(true);
  });

  it("isOpen tracks the dialog: false before open, true after, false after close", () => {
    const refs = buildPlateModal(document, { ariaLabel: "x" });
    expect(refs.isOpen()).toBe(false);
    refs.open(null);
    expect(refs.isOpen()).toBe(true);
    refs.close();
    expect(refs.isOpen()).toBe(false);
  });

  it("open locks the page behind the veil; every close path unlocks it", () => {
    /* A top-layer <dialog> does not stop the document scrolling under
       it; the class carries overflow: hidden (spec 2026-08-25, item 2). */
    const refs = buildPlateModal(document, { ariaLabel: "x" });
    const root = document.documentElement;
    refs.open(null);
    expect(root.classList.contains("pm-open")).toBe(true);
    refs.close();
    expect(root.classList.contains("pm-open")).toBe(false);
    refs.open(null);
    refs.closeBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.classList.contains("pm-open")).toBe(false);
    refs.open(null);
    refs.dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(root.classList.contains("pm-open")).toBe(false);
  });
});
