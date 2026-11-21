// @vitest-environment jsdom
/* DOM runtime test for the page TOC island (#438). jsdom has no layout
   and no IntersectionObserver, so the headings' rects are stubbed and
   the observer is a fake whose callback the tests drive. The island
   tracks the panel form only; the inline form needs no script. */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as tocModule from "../src/scripts/toc";
import { mountToc } from "../src/scripts/toc";

const LIST = `<ul class="toc-links">
  <li><a href="#a">A</a>
    <ul>
      <li><a href="#a1">A1</a></li>
      <li><a href="#a2">A2</a></li>
    </ul>
  </li>
  <li><a href="#b">B</a></li>
</ul>`;

const PANEL = `
  <nav class="toc-panel" data-toc aria-label="Sections">
    <p class="toc-label boxed-label" aria-hidden="true">Sections</p>
    ${LIST}
  </nav>`;

const INLINE = `
  <nav class="toc-inline-nav" aria-label="Sections menu">
    <details class="toc-inline">
      <summary class="toc-inline-summary">Sections (2)</summary>
      <div class="toc-inline-body">${LIST}</div>
    </details>
  </nav>`;

const HEADINGS = `<h2 id="a">A</h2><h3 id="a1">A1</h3><h3 id="a2">A2</h3><h2 id="b">B</h2>`;

const PAGE = `<aside>${PANEL}</aside><article>${INLINE}${HEADINGS}</article>`;

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

function observer(): FakeObserver {
  const first = FakeObserver.instances.at(0);
  if (first === undefined) throw new Error("no observer was created");
  return first;
}

function fire(id: string): void {
  observer().callback([{ isIntersecting: true, target: byId(id) }]);
}

function current(): string[] {
  return [...document.querySelectorAll('[data-toc] [aria-current="true"]')].map(
    (a) => a.getAttribute("href")?.slice(1) ?? "",
  );
}

describe("page TOC island (DOM runtime)", () => {
  beforeEach(() => {
    document.body.innerHTML = PAGE;
    history.replaceState(null, "", "/");
    FakeObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", FakeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("exports only the island: no gutter measuring is left", () => {
    expect(Object.keys(tocModule).sort()).toEqual(["mountToc"]);
  });

  it("writes no mode and no layout variables", () => {
    mountToc(document);

    expect(el("[data-toc]").hasAttribute("data-toc-mode")).toBe(false);
    expect(el("[data-toc]").getAttribute("style")).toBeNull();
  });

  it("marks the observed heading current", () => {
    mountToc(document);
    fire("b");

    expect(current()).toEqual(["b"]);
  });

  it("never marks the inline form's links", () => {
    mountToc(document);
    fire("a2");

    expect(
      document.querySelectorAll(
        "details.toc-inline [aria-current], details.toc-inline [data-toc-parent-current]",
      ),
    ).toHaveLength(0);

    expect(current()).toEqual(["a2"]);
  });

  it("an h3 marks itself current and its h2 as parent-current", () => {
    mountToc(document);
    fire("a2");

    expect(current()).toEqual(["a2"]);

    expect(
      el('[data-toc] a[href="#a"]').hasAttribute("data-toc-parent-current"),
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
      .querySelector("[data-toc] .toc-links")
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
      .querySelector("[data-toc] .toc-links")
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

  it("mounting twice is a no-op", () => {
    mountToc(document);
    mountToc(document);

    expect(FakeObserver.instances).toHaveLength(1);
  });

  it("destroy stops tracking and releases the claim", () => {
    const handle = mountToc(document);
    fire("a");
    handle.destroy();

    expect(observer().disconnect).toHaveBeenCalled();
    expect(el("[data-toc]").hasAttribute("data-island-toc")).toBe(false);

    history.replaceState(null, "", "#b");
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    expect(current()).toEqual(["a"]);

    mountToc(document);

    expect(FakeObserver.instances).toHaveLength(2);
  });

  it("takes a selector for the panel", () => {
    const node = el("[data-toc]");
    node.removeAttribute("data-toc");
    node.setAttribute("data-page-toc", "");
    mountToc(document, { selector: "[data-page-toc]" });
    fire("b");

    expect(
      el('[data-page-toc] a[href="#b"]').getAttribute("aria-current"),
    ).toBe("true");
  });

  it("an inline-only page is a no-op", () => {
    document.body.innerHTML = `<article>${INLINE}${HEADINGS}</article>`;

    expect(() => {
      mountToc(document);
    }).not.toThrow();

    expect(FakeObserver.instances).toHaveLength(0);
  });
});
