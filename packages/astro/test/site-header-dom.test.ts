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
  <ul id="primary-menu" class="menu"></ul>
  <div class="navigation-search-wrap">
    <button type="button" class="navigation-search-icon" aria-expanded="false"></button>
    <div class="navigation-search-form"><input type="search" class="search-field" /></div>
  </div>
  <a href="#elsewhere" id="elsewhere">elsewhere</a>`;

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

function searchBtn(): HTMLButtonElement {
  const el = document.querySelector<HTMLButtonElement>(
    ".navigation-search-icon",
  );

  if (!el) throw new Error("no search button");
  return el;
}

function searchWrap(): HTMLElement {
  const el = document.querySelector<HTMLElement>(".navigation-search-wrap");
  if (!el) throw new Error("no search wrap");
  return el;
}

function searchField(): HTMLInputElement {
  const el = document.querySelector<HTMLInputElement>(".search-field");
  if (!el) throw new Error("no search field");
  return el;
}

describe("site header island (DOM runtime)", () => {
  beforeEach(() => {
    document.body.innerHTML = PAGE;
  });

  it("refreshes the date box to today's formatted date", () => {
    mountSiteHeader(document);

    expect(document.getElementById("header-date")?.textContent).toBe(
      formatHeaderDate(new Date()),
    );
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

    expect(document.getElementById("header-date")?.textContent).toBe(
      formatHeaderDate(new Date()),
    );
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

    expect(document.getElementById("header-date")?.textContent).toBe(
      formatHeaderDate(new Date()),
    );
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

  /* The search flyout (owner report 2026-09-09): it used to open on
     :focus-within alone, so the magnifier could open it but never close
     it, unlike the menu button. With the island mounted it is a
     disclosure like the menu: the magnifier toggles, Escape and an
     outside press close, and keyboard focus leaving the whole wrap
     closes (the focus-within manner it replaces). */
  describe("search flyout", () => {
    it("marks the wrap so the stylesheet hands control to the island", () => {
      mountSiteHeader(document);
      expect(searchWrap().hasAttribute("data-search-js")).toBe(true);
    });

    it("the magnifier opens the flyout, focuses the field, and closes it again", () => {
      mountSiteHeader(document);
      searchBtn().click();
      expect(searchWrap().classList.contains("search-open")).toBe(true);
      expect(searchBtn().getAttribute("aria-expanded")).toBe("true");
      expect(document.activeElement).toBe(searchField());
      searchBtn().click();
      expect(searchWrap().classList.contains("search-open")).toBe(false);
      expect(searchBtn().getAttribute("aria-expanded")).toBe("false");
    });

    it("Escape closes the flyout and refocuses the magnifier", () => {
      mountSiteHeader(document);
      searchBtn().click();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(searchWrap().classList.contains("search-open")).toBe(false);
      expect(document.activeElement).toBe(searchBtn());
    });

    it("a pointerdown outside the wrap closes it; inside leaves it open", () => {
      mountSiteHeader(document);
      searchBtn().click();
      searchField().dispatchEvent(new Event("pointerdown", { bubbles: true }));
      expect(searchWrap().classList.contains("search-open")).toBe(true);
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      expect(searchWrap().classList.contains("search-open")).toBe(false);
    });

    it("focus leaving the wrap closes it; focus moving within it does not", () => {
      mountSiteHeader(document);
      searchBtn().click();

      searchField().dispatchEvent(
        new FocusEvent("focusout", {
          bubbles: true,
          relatedTarget: searchBtn(),
        }),
      );

      expect(searchWrap().classList.contains("search-open")).toBe(true);

      searchField().dispatchEvent(
        new FocusEvent("focusout", {
          bubbles: true,
          relatedTarget: document.getElementById("elsewhere"),
        }),
      );

      expect(searchWrap().classList.contains("search-open")).toBe(false);
    });

    it("a focusout with no destination is not a close (Safari blurs the field before a magnifier click lands)", () => {
      mountSiteHeader(document);
      searchBtn().click();

      searchField().dispatchEvent(
        new FocusEvent("focusout", { bubbles: true, relatedTarget: null }),
      );

      expect(searchWrap().classList.contains("search-open")).toBe(true);
    });

    it("Escape and outside presses close the menu and the flyout independently", () => {
      mountSiteHeader(document);
      btn().click();
      searchBtn().click();
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(menu().classList.contains("open")).toBe(false);
      expect(searchWrap().classList.contains("search-open")).toBe(false);
    });

    it("mounting twice wires the magnifier once", () => {
      mountSiteHeader(document);
      mountSiteHeader(document);
      searchBtn().click();
      expect(searchWrap().classList.contains("search-open")).toBe(true);
    });

    it("destroy unwires the magnifier and drops the marker", () => {
      const handle = mountSiteHeader(document);
      handle.destroy();
      expect(searchWrap().hasAttribute("data-search-js")).toBe(false);
      searchBtn().click();
      expect(searchWrap().classList.contains("search-open")).toBe(false);
    });

    it("a page without the search markup mounts the menu as before", () => {
      document.body.innerHTML = `
        <button type="button" class="menu-toggle" aria-controls="primary-menu" aria-expanded="false"></button>
        <ul id="primary-menu" class="menu"></ul>`;

      mountSiteHeader(document);
      btn().click();
      expect(menu().classList.contains("open")).toBe(true);
    });
  });
});
