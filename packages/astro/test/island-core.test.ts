// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { claim, release } from "../src/scripts/core/island";
import { el, iconButton } from "../src/scripts/core/dom";

describe("island claim", () => {
  it("first claim wins, second is a no-op", () => {
    const div = document.createElement("div");
    expect(claim(div, "demo")).toBe(true);
    expect(claim(div, "demo")).toBe(false);
    expect(div.hasAttribute("data-island-demo")).toBe(true);
  });
  it("claims are per island name", () => {
    const div = document.createElement("div");
    expect(claim(div, "one")).toBe(true);
    expect(claim(div, "two")).toBe(true);
  });
  it("release clears a claim so it can be retaken", () => {
    const div = document.createElement("div");
    expect(claim(div, "demo")).toBe(true);
    release(div, "demo");
    expect(claim(div, "demo")).toBe(true);
  });
});

describe("core dom builders", () => {
  it("el builds tag/class/text", () => {
    const p = el(document, "p", "hit-meta", "text");
    expect(p.tagName).toBe("P");
    expect(p.className).toBe("hit-meta");
    expect(p.textContent).toBe("text");
  });
  it("el omits absent class and text", () => {
    const s = el(document, "span");
    expect(s.hasAttribute("class")).toBe(false);
    expect(s.textContent).toBe("");
  });
  it("iconButton builds a labeled type=button with svg content", () => {
    const b = iconButton(document, "lb-arrow icon-box", "Previous image", "<svg></svg>");
    expect(b.type).toBe("button");
    expect(b.className).toBe("lb-arrow icon-box");
    expect(b.getAttribute("aria-label")).toBe("Previous image");
    expect(b.innerHTML).toBe("<svg></svg>");
  });
});
