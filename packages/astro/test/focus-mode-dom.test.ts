// @vitest-environment jsdom
/* DOM runtime test for the focus-mode island (step 11.2: joins the mount
   contract, package-bound per owner decision 2, 2026-08-31). Mirrors the
   scroll-top island's claim/destroy idioms. Every mount is destroyed in
   afterEach: mountFocusMode listens on window by default, so a handle
   left undestroyed would keep firing into later tests. */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { IslandHandle } from "../src/scripts/core/island";
import { mountFocusMode } from "../src/scripts/focus-mode";

describe("focus-mode island (DOM runtime)", () => {
  let handles: IslandHandle[] = [];

  const mount = (): IslandHandle => {
    const h = mountFocusMode(document.documentElement);
    handles.push(h);
    return h;
  };

  beforeEach(() => {
    handles = [];
    document.documentElement.removeAttribute("data-focus");
    document.documentElement.removeAttribute("data-island-focus-mode");
  });

  afterEach(() => {
    for (const h of handles) h.destroy();
  });

  it("a keydown stamps data-focus=keyboard", () => {
    mount();
    window.dispatchEvent(new KeyboardEvent("keydown"));
    expect(document.documentElement.dataset.focus).toBe("keyboard");
  });

  it("a pointerdown stamps data-focus=pointer", () => {
    mount();
    window.dispatchEvent(new PointerEvent("pointerdown"));
    expect(document.documentElement.dataset.focus).toBe("pointer");
  });

  it("destroy removes both listeners and releases the claim; a second mount claims cleanly", () => {
    const handle = mount();
    window.dispatchEvent(new PointerEvent("pointerdown"));
    expect(document.documentElement.dataset.focus).toBe("pointer");
    handle.destroy();

    expect(
      document.documentElement.hasAttribute("data-island-focus-mode"),
    ).toBe(false);

    window.dispatchEvent(new KeyboardEvent("keydown"));
    /* Listeners are gone: the stamp stays at its last value, it does not
       flip back to keyboard. */
    expect(document.documentElement.dataset.focus).toBe("pointer");
    mount();

    expect(
      document.documentElement.hasAttribute("data-island-focus-mode"),
    ).toBe(true);

    window.dispatchEvent(new KeyboardEvent("keydown"));
    expect(document.documentElement.dataset.focus).toBe("keyboard");
  });
});
