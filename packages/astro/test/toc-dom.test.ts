// @vitest-environment jsdom
/* DOM runtime test for the page TOC island (#438). jsdom has no layout
   and no IntersectionObserver, so the anchor's and headings' rects are
   stubbed and the observer is a fake whose callback the tests drive. */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mountToc, TOC_STRIP_MIN_GUTTER } from "../src/scripts/toc";

const PAGE = `
  <button type="button" id="elsewhere">elsewhere</button>
  <div class="toc" data-toc>
    <button type="button" class="toc-tab" data-toc-tab aria-expanded="false" aria-controls="toc-panel">Sections</button>
    <div class="toc-panel" id="toc-panel" data-toc-panel>
      <button type="button" class="toc-close" data-toc-close aria-label="Close sections">x</button>
      <nav aria-label="Sections">
        <ul class="toc-links">
          <li><a href="#a">A</a>
            <ul>
              <li><a href="#a1">A1</a></li>
              <li><a href="#a2">A2</a></li>
            </ul>
          </li>
          <li><a href="#b">B</a></li>
        </ul>
      </nav>
    </div>
  </div>
  <h2 id="a">A</h2><h3 id="a1">A1</h3><h3 id="a2">A2</h3><h2 id="b">B</h2>`;

interface FakeEntry {
  isIntersecting: boolean;
  target: Element;
}

class FakeObserver {
  static instances: FakeObserver[] = [];
  callback: (entries: FakeEntry[]) => void;
  observed: Element[] = [];
  disconnect = vi.fn();
  observe = (el: Element): void => {
    this.observed.push(el);
  };
  constructor(callback: (entries: FakeEntry[]) => void) {
    this.callback = callback;
    FakeObserver.instances.push(this);
  }
}

let frames: FrameRequestCallback[] = [];

function runFrames(): void {
  const pending = frames;
  frames = [];

  pending.forEach((cb) => {
    cb(0);
  });
}

function el(selector: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`${selector} missing from the fixture`);
  return node;
}

function byId(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} missing from the fixture`);
  return node;
}

function setTop(node: Element, top: number): void {
  node.getBoundingClientRect = () => new DOMRect(0, top, 10, 10);
}

let gutter = 300;

function anchor(): HTMLElement {
  return el("[data-toc]");
}

function observer(): FakeObserver {
  const first = FakeObserver.instances.at(0);
  if (first === undefined) throw new Error("no observer was created");
  return first;
}

function fire(id: string): void {
  observer().callback([{ isIntersecting: true, target: byId(id) }]);
}

function current(): string[] {
  return [...document.querySelectorAll('[aria-current="true"]')].map(
    (a) => a.getAttribute("href")?.slice(1) ?? "",
  );
}

function press(key: string): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("page TOC island (DOM runtime)", () => {
  beforeEach(() => {
    document.body.innerHTML = PAGE;
    history.replaceState(null, "", "/");
    FakeObserver.instances = [];
    frames = [];
    gutter = 300;
    vi.stubGlobal("IntersectionObserver", FakeObserver);

    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });

    anchor().getBoundingClientRect = () => new DOMRect(gutter, 0, 600, 0);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("strip mode when the gutter is at least 220px, tab mode below", () => {
    expect(TOC_STRIP_MIN_GUTTER).toBe(220);
    gutter = 220;
    mountToc(document);

    expect(anchor().dataset.tocMode).toBe("strip");
    expect(anchor().style.getPropertyValue("--toc-edge")).toBe("220px");

    document.body.innerHTML = PAGE;
    gutter = 219;
    anchor().getBoundingClientRect = () => new DOMRect(gutter, 0, 600, 0);
    mountToc(document);

    expect(anchor().dataset.tocMode).toBe("tab");
    expect(anchor().style.getPropertyValue("--toc-edge")).toBe("219px");
  });

  it("re-measures on resize", () => {
    mountToc(document);

    expect(anchor().dataset.tocMode).toBe("strip");

    gutter = 100;
    window.dispatchEvent(new Event("resize"));
    runFrames();

    expect(anchor().dataset.tocMode).toBe("tab");
    expect(anchor().style.getPropertyValue("--toc-edge")).toBe("100px");
  });

  it("resizing into strip mode closes an open panel", () => {
    gutter = 100;
    mountToc(document);
    el("[data-toc-tab]").click();

    expect(anchor().hasAttribute("data-toc-open")).toBe(true);

    gutter = 300;
    window.dispatchEvent(new Event("resize"));
    runFrames();

    expect(anchor().dataset.tocMode).toBe("strip");
    expect(anchor().hasAttribute("data-toc-open")).toBe(false);
    expect(el("[data-toc-tab]").getAttribute("aria-expanded")).toBe("false");
  });

  it("the tab toggles the panel and aria-expanded", () => {
    gutter = 100;
    mountToc(document);
    const tab = el("[data-toc-tab]");

    tab.click();

    expect(anchor().hasAttribute("data-toc-open")).toBe(true);
    expect(tab.getAttribute("aria-expanded")).toBe("true");

    tab.click();

    expect(anchor().hasAttribute("data-toc-open")).toBe(false);
    expect(tab.getAttribute("aria-expanded")).toBe("false");
  });

  it("following a link, a click outside, the close button, and Escape each close the panel", () => {
    gutter = 100;
    mountToc(document);
    const tab = el("[data-toc-tab]");
    const isOpen = (): boolean => anchor().hasAttribute("data-toc-open");

    tab.click();
    el('.toc-links a[href="#b"]').click();

    expect(isOpen()).toBe(false);

    tab.click();
    byId("elsewhere").click();

    expect(isOpen()).toBe(false);

    tab.click();
    el("[data-toc-close]").click();

    expect(isOpen()).toBe(false);

    tab.click();
    press("Escape");

    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(tab);
  });

  it("Escape with the panel closed does nothing", () => {
    gutter = 100;
    mountToc(document);
    const other = byId("elsewhere");
    other.focus();
    press("Escape");

    expect(document.activeElement).toBe(other);
  });

  it("marks the observed heading current", () => {
    mountToc(document);
    fire("b");

    expect(current()).toEqual(["b"]);
  });

  it("an h3 marks itself current and its h2 as parent-current", () => {
    mountToc(document);
    fire("a2");

    expect(current()).toEqual(["a2"]);

    expect(
      el('.toc-links a[href="#a"]').hasAttribute("data-toc-parent-current"),
    ).toBe(true);

    fire("b");

    expect(document.querySelector("[data-toc-parent-current]")).toBeNull();
  });

  it("marks the opening section", () => {
    setTop(byId("a"), 100);
    setTop(byId("a1"), 300);
    setTop(byId("a2"), 900);
    setTop(byId("b"), 1400);
    mountToc(document);

    expect(current()).toEqual(["a1"]);
  });

  it("a hash jump marks its target and the observer stays quiet for 900ms", () => {
    vi.useFakeTimers();
    mountToc(document);
    history.replaceState(null, "", "#b");
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    expect(current()).toEqual(["b"]);

    fire("a");

    expect(current()).toEqual(["b"]);

    vi.advanceTimersByTime(901);
    fire("a");

    expect(current()).toEqual(["a"]);
  });

  it("tracks ids that are not valid CSS selectors", () => {
    document
      .querySelector(".toc-links")
      ?.insertAdjacentHTML(
        "beforeend",
        '<li><a href="#0.17-release">Release</a></li>',
      );

    document.body.insertAdjacentHTML(
      "beforeend",
      '<h2 id="0.17-release">Release</h2>',
    );

    mountToc(document);

    expect(observer().observed).toContain(byId("0.17-release"));

    fire("0.17-release");

    expect(current()).toEqual(["0.17-release"]);
  });

  it("skips a link whose target is missing", () => {
    document
      .querySelector(".toc-links")
      ?.insertAdjacentHTML("beforeend", '<li><a href="#ghost">Ghost</a></li>');

    expect(() => {
      mountToc(document);
    }).not.toThrow();

    expect(observer().observed.map((node) => node.id)).toEqual([
      "a",
      "a1",
      "a2",
      "b",
    ]);
  });

  it("a malformed hash neither throws nor stops the island", () => {
    history.replaceState(null, "", "#50%");

    expect(() => {
      mountToc(document);
    }).not.toThrow();

    expect(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }).not.toThrow();

    fire("b");

    expect(current()).toEqual(["b"]);
  });

  it("focus leaving the open panel closes it", () => {
    gutter = 100;
    mountToc(document);
    el("[data-toc-tab]").click();
    el('.toc-links a[href="#b"]').focus();
    byId("elsewhere").focus();

    expect(anchor().hasAttribute("data-toc-open")).toBe(false);
  });

  it("focus moving inside the open panel keeps it open", () => {
    gutter = 100;
    mountToc(document);
    el("[data-toc-tab]").click();
    el('.toc-links a[href="#a"]').focus();
    el('.toc-links a[href="#b"]').focus();

    expect(anchor().hasAttribute("data-toc-open")).toBe(true);
  });

  it("Escape inside another open dialog leaves the closed TOC alone", () => {
    gutter = 100;

    document.body.insertAdjacentHTML(
      "beforeend",
      '<dialog open><button type="button" id="in-dialog">x</button></dialog>',
    );

    mountToc(document);
    const inner = byId("in-dialog");
    inner.focus();

    inner.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(document.activeElement).toBe(inner);
    expect(anchor().hasAttribute("data-toc-open")).toBe(false);
  });

  it("mounting twice is a no-op", () => {
    gutter = 100;
    mountToc(document);
    mountToc(document);

    expect(FakeObserver.instances).toHaveLength(1);

    el("[data-toc-tab]").click();

    expect(anchor().hasAttribute("data-toc-open")).toBe(true);
  });

  it("destroy disconnects the observer, drops the listeners, and releases the claim", () => {
    gutter = 100;
    const handle = mountToc(document);
    handle.destroy();

    expect(observer().disconnect).toHaveBeenCalled();
    expect(anchor().hasAttribute("data-island-toc")).toBe(false);

    el("[data-toc-tab]").click();

    expect(anchor().hasAttribute("data-toc-open")).toBe(false);

    gutter = 300;
    window.dispatchEvent(new Event("resize"));
    runFrames();

    expect(anchor().dataset.tocMode).toBe("tab");

    mountToc(document);

    expect(FakeObserver.instances).toHaveLength(2);
  });

  it("takes a selector for the anchor", () => {
    const node = anchor();
    node.removeAttribute("data-toc");
    node.setAttribute("data-page-toc", "");
    mountToc(document, { selector: "[data-page-toc]" });

    expect(el("[data-page-toc]").dataset.tocMode).toBe("strip");
  });

  it("does nothing when there is no [data-toc]", () => {
    document.body.innerHTML = "<p>no toc</p>";

    expect(() => {
      mountToc(document);
    }).not.toThrow();

    expect(FakeObserver.instances).toHaveLength(0);
  });
});
