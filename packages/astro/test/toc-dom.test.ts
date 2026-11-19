// @vitest-environment jsdom
/* DOM runtime test for the page TOC island (#438). jsdom has no layout
   and no IntersectionObserver, so the reference column's, the two
   shells', and the headings' rects are stubbed, and the observer is a
   fake whose callback the tests drive. */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mountToc, TOC_STRIP_MIN_GUTTER } from "../src/scripts/toc";

const LIST = `<ul class="toc-links">
  <li><a href="#a">A</a>
    <ul>
      <li><a href="#a1">A1</a></li>
      <li><a href="#a2">A2</a></li>
    </ul>
  </li>
  <li><a href="#b">B</a></li>
</ul>`;

const TOC = `
  <div class="toc" data-toc>
    <div class="toc-strip" data-toc-strip>
      <div class="toc-panel">
        <p class="toc-label boxed-label" aria-hidden="true">Sections</p>
        <nav aria-label="Sections">${LIST}</nav>
      </div>
    </div>
    <details class="toc-inline" data-toc-inline>
      <summary class="toc-inline-summary">Sections (2)</summary>
      <nav class="toc-inline-body" aria-label="Sections">${LIST}</nav>
    </details>
  </div>`;

const HEADINGS = `<h2 id="a">A</h2><h3 id="a1">A1</h3><h3 id="a2">A2</h3><h2 id="b">B</h2>`;

const PAGE = `<div class="shell"><article>${TOC}${HEADINGS}</article></div>`;

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

function inline(): HTMLDetailsElement {
  const node = document.querySelector("details[data-toc-inline]");

  if (!(node instanceof HTMLDetailsElement)) {
    throw new Error("the inline disclosure is missing from the fixture");
  }

  return node;
}

/* The reference column sits at the gutter; both shells sit 25px inside
   it, as the component does inside an article's padding. */
function stubLayout(column: Element = el(".shell")): void {
  column.getBoundingClientRect = () => new DOMRect(gutter, 0, 900, 2000);

  for (const shell of ["[data-toc-strip]", "[data-toc-inline]"]) {
    el(shell).getBoundingClientRect = () => new DOMRect(gutter + 25, 0, 600, 0);
  }
}

function resize(): void {
  window.dispatchEvent(new Event("resize"));
  runFrames();
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
  return [
    ...document.querySelectorAll('[data-toc-strip] [aria-current="true"]'),
  ].map((a) => a.getAttribute("href")?.slice(1) ?? "");
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

    stubLayout();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("strip mode at a 220px gutter, inline below", () => {
    expect(TOC_STRIP_MIN_GUTTER).toBe(220);
    gutter = 220;
    stubLayout();
    mountToc(document);

    expect(anchor().dataset.tocMode).toBe("strip");
    expect(anchor().style.getPropertyValue("--toc-edge")).toBe("220px");
    expect(anchor().style.getPropertyValue("--toc-inset")).toBe("25px");

    document.body.innerHTML = PAGE;
    gutter = 219;
    stubLayout();
    mountToc(document);

    expect(anchor().dataset.tocMode).toBe("inline");
    expect(anchor().style.getPropertyValue("--toc-edge")).toBe("219px");
  });

  it("re-measures on resize", () => {
    mountToc(document);

    expect(anchor().dataset.tocMode).toBe("strip");

    gutter = 100;
    resize();

    expect(anchor().dataset.tocMode).toBe("inline");
    expect(anchor().style.getPropertyValue("--toc-edge")).toBe("100px");
  });

  it("an open inline disclosure stays open across mode changes", () => {
    gutter = 100;
    mountToc(document);
    inline().open = true;
    gutter = 300;
    resize();

    expect(anchor().dataset.tocMode).toBe("strip");

    gutter = 100;
    resize();

    expect(anchor().dataset.tocMode).toBe("inline");
    expect(inline().open).toBe(true);
  });

  it("marks the observed heading current", () => {
    mountToc(document);
    fire("b");

    expect(current()).toEqual(["b"]);
  });

  it("only the strip's links are tracked", () => {
    mountToc(document);
    fire("a2");

    expect(
      document.querySelectorAll(
        "[data-toc-inline] [aria-current], [data-toc-inline] [data-toc-parent-current]",
      ),
    ).toHaveLength(0);

    expect(current()).toEqual(["a2"]);
  });

  it("an h3 marks itself current and its h2 as parent-current", () => {
    mountToc(document);
    fire("a2");

    expect(current()).toEqual(["a2"]);

    expect(
      el('[data-toc-strip] a[href="#a"]').hasAttribute(
        "data-toc-parent-current",
      ),
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
      .querySelector("[data-toc-strip] .toc-links")
      ?.insertAdjacentHTML(
        "beforeend",
        '<li><a href="#0.17-release">Release</a></li>',
      );

    el("article").insertAdjacentHTML(
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
      .querySelector("[data-toc-strip] .toc-links")
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

  it("takes a column selector for the reference edge", () => {
    document.body.innerHTML = `<div class="page-col"><article>${TOC}${HEADINGS}</article></div>`;
    gutter = 400;
    stubLayout(el(".page-col"));
    mountToc(document, { column: ".page-col" });

    expect(anchor().style.getPropertyValue("--toc-edge")).toBe("400px");
    expect(anchor().dataset.tocMode).toBe("strip");
  });

  it("falls back to the parent element when no column matches", () => {
    document.body.innerHTML = `<article>${TOC}${HEADINGS}</article>`;
    gutter = 50;
    stubLayout(el("article"));

    expect(() => {
      mountToc(document);
    }).not.toThrow();

    expect(anchor().dataset.tocMode).toBe("inline");
    expect(anchor().style.getPropertyValue("--toc-edge")).toBe("50px");
  });

  it("mounting twice is a no-op", () => {
    mountToc(document);
    mountToc(document);

    expect(FakeObserver.instances).toHaveLength(1);
  });

  it("destroy stops re-measuring and tracking, and releases the claim", () => {
    const handle = mountToc(document);
    handle.destroy();

    expect(observer().disconnect).toHaveBeenCalled();
    expect(anchor().hasAttribute("data-island-toc")).toBe(false);

    gutter = 100;
    stubLayout();
    resize();

    expect(anchor().dataset.tocMode).toBe("strip");

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
