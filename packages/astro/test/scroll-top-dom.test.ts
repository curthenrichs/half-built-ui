// @vitest-environment jsdom
/* DOM runtime test for the scroll-top island (step 9): the floater that
   shows once the masthead leaves the viewport, born from Base.astro's
   inline script. jsdom has no IntersectionObserver, so this stubs one and
   captures the callback to drive it directly. */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mountScrollTop } from "../src/scripts/scroll-top";

const PAGE = `
  <header id="masthead"></header>
  <button type="button" id="scroll-to-top"></button>`;

class FakeObserver {
  static instances: FakeObserver[] = [];
  callback: (entries: { isIntersecting: boolean }[]) => void;
  disconnect = vi.fn();
  observe = vi.fn();
  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    this.callback = callback;
    FakeObserver.instances.push(this);
  }
}

describe("scroll-top island (DOM runtime)", () => {
  beforeEach(() => {
    document.body.innerHTML = PAGE;
    FakeObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", FakeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("observes the masthead and toggles show as it leaves and re-enters the viewport", () => {
    mountScrollTop(document);
    const [observer] = FakeObserver.instances;

    expect(observer.observe).toHaveBeenCalledWith(
      document.getElementById("masthead"),
    );

    observer.callback([{ isIntersecting: false }]);

    expect(
      document.getElementById("scroll-to-top")?.classList.contains("show"),
    ).toBe(true);

    observer.callback([{ isIntersecting: true }]);

    expect(
      document.getElementById("scroll-to-top")?.classList.contains("show"),
    ).toBe(false);
  });

  it("mounting twice observes once (claim guards the second pass)", () => {
    mountScrollTop(document);
    mountScrollTop(document);
    expect(FakeObserver.instances.length).toBe(1);
  });

  it("destroy disconnects the observer and releases the claim", () => {
    const handle = mountScrollTop(document);
    const [observer] = FakeObserver.instances;
    handle.destroy();
    expect(observer.disconnect).toHaveBeenCalledOnce();

    expect(
      document
        .getElementById("scroll-to-top")
        ?.hasAttribute("data-island-scroll-top"),
    ).toBe(false);
  });

  it("does nothing when the button or masthead is missing", () => {
    document.body.innerHTML = `<button type="button" id="scroll-to-top"></button>`;
    mountScrollTop(document);
    expect(FakeObserver.instances.length).toBe(0);
  });

  it("destroying the losing mount's handle leaves the winner's observer and claim intact", () => {
    const a = mountScrollTop(document);
    const b = mountScrollTop(document);
    const [observer] = FakeObserver.instances;
    b.destroy();

    expect(
      document
        .getElementById("scroll-to-top")
        ?.hasAttribute("data-island-scroll-top"),
    ).toBe(true);

    expect(observer.disconnect).not.toHaveBeenCalled();
    a.destroy();
    expect(observer.disconnect).toHaveBeenCalledOnce();

    expect(
      document
        .getElementById("scroll-to-top")
        ?.hasAttribute("data-island-scroll-top"),
    ).toBe(false);
  });
});
