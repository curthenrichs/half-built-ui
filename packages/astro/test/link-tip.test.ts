// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { mountLinkTips } from "../src/scripts/link-tip";

function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from the test fixture`);
  return el;
}

function tipEl(): HTMLElement {
  const el = document.querySelector(".link-tip");

  if (!(el instanceof HTMLElement)) {
    throw new Error("no .link-tip in the document");
  }

  return el;
}

describe("link-tip island (DOM runtime)", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<a id="ext" href="http://example.com">example</a>' +
      '<a id="int" href="/about/" data-tooltip="About">about</a>' +
      '<ul data-tip-place="below" data-tip-align="end"><li><a id="social" href="http://s.example">s</a></li></ul>';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute("data-island-link-tip");
    document.querySelector(".link-tip")?.remove();
  });

  it("mount appends one singleton; destroy removes node, listeners, and claim", () => {
    const handle = mountLinkTips(document);
    expect(document.querySelectorAll(".link-tip").length).toBe(1);

    expect(document.documentElement.hasAttribute("data-island-link-tip")).toBe(
      true,
    );

    handle.destroy();
    expect(document.querySelector(".link-tip")).toBeNull();

    expect(document.documentElement.hasAttribute("data-island-link-tip")).toBe(
      false,
    );

    byId("ext").dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(document.querySelector(".link-tip")).toBeNull();
  });

  it("mounting twice claims once; the second handle's destroy is a no-op", () => {
    const first = mountLinkTips(document);
    const second = mountLinkTips(document);
    expect(document.querySelectorAll(".link-tip").length).toBe(1);
    second.destroy();

    expect(document.documentElement.hasAttribute("data-island-link-tip")).toBe(
      true,
    );

    first.destroy();

    expect(document.documentElement.hasAttribute("data-island-link-tip")).toBe(
      false,
    );
  });

  it("hovering an external link reveals its href; data-tooltip beats href", () => {
    const handle = mountLinkTips(document);
    byId("ext").dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(tipEl().textContent).toBe("http://example.com");
    expect(tipEl().hidden).toBe(false);
    byId("int").dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(tipEl().textContent).toBe("About");
    handle.destroy();
  });

  it("mouseout, Escape, and scroll each hide the tip", () => {
    const handle = mountLinkTips(document);

    const show = (): void => {
      byId("ext").dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    };

    show();
    byId("ext").dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    expect(tipEl().hidden).toBe(true);
    show();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );

    expect(tipEl().hidden).toBe(true);
    show();
    document.dispatchEvent(new Event("scroll"));
    expect(tipEl().hidden).toBe(true);
    handle.destroy();
  });

  it("a hover-none device mounts inert but still claims", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: q === "(hover: none)",
    }));

    const handle = mountLinkTips(document);
    expect(document.querySelector(".link-tip")).toBeNull();

    expect(document.documentElement.hasAttribute("data-island-link-tip")).toBe(
      true,
    );

    handle.destroy();

    expect(document.documentElement.hasAttribute("data-island-link-tip")).toBe(
      false,
    );
  });
});
