// @vitest-environment jsdom
/* DOM runtime test for the site-header island (step 9): the masthead's
   date-box refresh and the phone menu toggle, born from SiteHeader.astro's
   inline script. */
import { describe, it, expect, beforeEach } from "vitest";
import { mountSiteHeader } from "../src/scripts/site-header";
import { formatHeaderDate } from "../src/lib/header-date";

const PAGE = `
  <div class="date boxed-label" id="header-date">stale</div>
  <button type="button" class="menu-toggle" aria-controls="primary-menu" aria-expanded="false"></button>
  <ul id="primary-menu" class="menu"></ul>`;

function btn(): HTMLButtonElement {
  const el = document.querySelector<HTMLButtonElement>(".menu-toggle");
  if (!el) throw new Error("no menu button");
  return el;
}

function menu(): HTMLElement {
  const el = document.getElementById("primary-menu");
  if (!el) throw new Error("no menu");
  return el;
}

describe("site header island (DOM runtime)", () => {
  beforeEach(() => {
    document.body.innerHTML = PAGE;
  });

  it("refreshes the date box to today's formatted date", () => {
    mountSiteHeader(document);
    expect(document.getElementById("header-date")?.textContent).toBe(formatHeaderDate(new Date()));
  });

  it("click toggles the open class and aria-expanded", () => {
    mountSiteHeader(document);
    btn().click();
    expect(menu().classList.contains("open")).toBe(true);
    expect(btn().getAttribute("aria-expanded")).toBe("true");
    btn().click();
    expect(menu().classList.contains("open")).toBe(false);
    expect(btn().getAttribute("aria-expanded")).toBe("false");
  });

  it("Escape closes the menu and refocuses the button", () => {
    mountSiteHeader(document);
    btn().click();
    expect(menu().classList.contains("open")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(menu().classList.contains("open")).toBe(false);
    expect(document.activeElement).toBe(btn());
  });

  it("a pointerdown outside the menu closes it", () => {
    mountSiteHeader(document);
    btn().click();
    expect(menu().classList.contains("open")).toBe(true);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(menu().classList.contains("open")).toBe(false);
  });

  it("a pointerdown inside the menu or the button leaves it open", () => {
    mountSiteHeader(document);
    btn().click();
    btn().dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(menu().classList.contains("open")).toBe(true);
  });

  it("mounting twice binds the menu once (idempotent by claim)", () => {
    mountSiteHeader(document);
    mountSiteHeader(document);
    btn().click();
    expect(menu().classList.contains("open")).toBe(true);
  });

  it("mounting twice still refreshes the date box (unconditional, idempotent by nature)", () => {
    mountSiteHeader(document);
    mountSiteHeader(document);
    expect(document.getElementById("header-date")?.textContent).toBe(formatHeaderDate(new Date()));
  });

  it("destroy stops the toggle", () => {
    const handle = mountSiteHeader(document);
    handle.destroy();
    btn().click();
    expect(menu().classList.contains("open")).toBe(false);
  });

  it("destroy releases the claim so a later mount rewires the button", () => {
    const handle = mountSiteHeader(document);
    handle.destroy();
    mountSiteHeader(document);
    btn().click();
    expect(menu().classList.contains("open")).toBe(true);
  });

  it("refreshes the date box even without a menu button present", () => {
    document.body.innerHTML = `<div id="header-date">stale</div>`;
    mountSiteHeader(document);
    expect(document.getElementById("header-date")?.textContent).toBe(formatHeaderDate(new Date()));
  });

  it("a formatDate option overrides the date box's formatter", () => {
    mountSiteHeader(document, { formatDate: () => "STAMPED" });
    expect(document.getElementById("header-date")?.textContent).toBe("STAMPED");
  });

  it("destroying the losing mount's handle leaves the winner's wiring and claim intact", () => {
    const a = mountSiteHeader(document);
    const b = mountSiteHeader(document);
    b.destroy();
    expect(btn().hasAttribute("data-island-site-header")).toBe(true);
    btn().click();
    expect(menu().classList.contains("open")).toBe(true);
    a.destroy();
    expect(btn().hasAttribute("data-island-site-header")).toBe(false);
    btn().click();
    expect(menu().classList.contains("open")).toBe(true);
  });
});
