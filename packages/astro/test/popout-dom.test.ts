// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import {
  mountPopouts,
  popoutMode,
  offscreen,
  isSwipeClose,
  nextFocusableAfter,
} from "../src/scripts/popout";
import { polyfillDialog } from "./helpers";
import type { IslandHandle } from "../src/scripts/core/island";

polyfillDialog();

const FIXTURE =
  '<div class="table-scroll"><table><tbody>' +
  '<tr><td><button type="button" class="popout-trigger" id="t1" data-popout-label="Silk PLA" aria-expanded="false">Note</button>' +
  '<template class="popout-content">Got <a id="inner" href="/x/">stringy</a>.</template></td></tr>' +
  '<tr><td><button type="button" class="popout-trigger" id="t2" data-popout-label="Wood PLA" aria-expanded="false">Note</button>' +
  '<template class="popout-content">Hardened nozzle.</template></td></tr>' +
  '<tr><td><button type="button" class="popout-trigger" id="bare" data-popout-label="Bare">Note</button></td></tr>' +
  '</tbody></table></div><p id="outside">elsewhere</p>';

function byId(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} missing from the fixture`);
  return node;
}

function surface(): HTMLDialogElement {
  const node = document.querySelector("dialog.popout");

  if (!(node instanceof HTMLDialogElement)) {
    throw new Error("no dialog.popout in the document");
  }

  return node;
}

function view(): Window {
  const win = document.defaultView;
  if (!win) throw new Error("jsdom document has no window");
  return win;
}

/* jsdom ships no matchMedia; define one on the document's own window
   (what the island reads), answering the phone query as asked. */
function stubPhone(phone: boolean): void {
  Object.defineProperty(view(), "matchMedia", {
    configurable: true,
    writable: true,
    value: (q: string) => ({ matches: phone, media: q }),
  });
}

/* A matchMedia that evaluates the island's max-width query against a
   given viewport width, so the boundary is tested as the browser would
   answer it rather than as a canned yes or no. */
function stubWidth(width: number): void {
  Object.defineProperty(view(), "matchMedia", {
    configurable: true,
    writable: true,
    value: (q: string) => {
      const m = /\(max-width:\s*(\d+)px\)/.exec(q);
      return { matches: m ? width <= Number(m[1]) : false, media: q };
    },
  });
}

/* The island calls the document's own window's rAF, so the stub goes
   there (not vi.stubGlobal), and the original is put back after. */
async function withTimerRaf(run: () => Promise<void>): Promise<void> {
  const saved = Object.getOwnPropertyDescriptor(
    view(),
    "requestAnimationFrame",
  );

  Object.defineProperty(view(), "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: (cb: FrameRequestCallback) =>
      setTimeout(() => {
        cb(0);
      }, 0),
  });

  try {
    await run();
  } finally {
    if (saved) Object.defineProperty(view(), "requestAnimationFrame", saved);
    else Reflect.deleteProperty(view(), "requestAnimationFrame");
  }
}

function offTop(t: HTMLElement): void {
  t.getBoundingClientRect = () =>
    ({
      left: 10,
      right: 50,
      top: -60,
      bottom: -40,
      width: 40,
      height: 20,
    }) as DOMRect;
}

function click(target: HTMLElement): void {
  target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function touch(type: string, y: number): Event {
  const list = { item: () => ({ clientY: y }) };
  return Object.assign(new Event(type, { bubbles: true }), {
    touches: list,
    changedTouches: list,
  });
}

let handle: IslandHandle | undefined;

beforeEach(() => {
  document.body.innerHTML = FIXTURE;
  document.documentElement.className = "";
});

afterEach(() => {
  handle?.destroy();
  handle = undefined;
  Reflect.deleteProperty(view(), "matchMedia");
});

describe("popout pure helpers", () => {
  it("mode is sheet only when the phone query matches", () => {
    expect(popoutMode(null)).toBe("anchored");
    expect(popoutMode({})).toBe("anchored");

    expect(
      popoutMode({
        matchMedia: (q: string) => ({ matches: q === "(max-width: 768px)" }),
      }),
    ).toBe("sheet");
  });

  it("offscreen means wholly outside the viewport", () => {
    const vp = { width: 800, height: 600 };

    expect(offscreen({ left: 10, right: 50, top: 10, bottom: 30 }, vp)).toBe(
      false,
    );

    expect(offscreen({ left: 10, right: 50, top: -40, bottom: -1 }, vp)).toBe(
      true,
    );

    expect(offscreen({ left: 10, right: 50, top: 600, bottom: 620 }, vp)).toBe(
      true,
    );

    expect(offscreen({ left: -60, right: -1, top: 10, bottom: 30 }, vp)).toBe(
      true,
    );

    expect(offscreen({ left: 10, right: 50, top: -5, bottom: 12 }, vp)).toBe(
      false,
    );
  });

  it("a swipe closes at 60px down and not before", () => {
    expect(isSwipeClose(100, 160)).toBe(true);
    expect(isSwipeClose(100, 159)).toBe(false);
    expect(isSwipeClose(100, 40)).toBe(false);
    expect(isSwipeClose(null, 400)).toBe(false);
  });
});

describe("nextFocusableAfter", () => {
  it("returns the first focusable after the anchor, skipping the given subtree", () => {
    document.body.innerHTML =
      '<button id="a">A</button><div id="skip"><a id="in" href="#">x</a></div>' +
      '<span>text</span><a id="b" href="#">B</a>';

    const got = nextFocusableAfter(document, byId("a"), byId("skip"));
    expect(got?.id).toBe("b");
  });

  it("returns null when nothing focusable follows", () => {
    document.body.innerHTML = '<button id="a">A</button><p>end</p>';
    expect(nextFocusableAfter(document, byId("a"), byId("a"))).toBeNull();
  });

  it("skips disabled, hidden and tabindex=-1 elements", () => {
    document.body.innerHTML =
      '<button id="a">A</button><button disabled>d</button>' +
      '<a href="#" tabindex="-1">n</a><input type="hidden"><a id="b" href="#">B</a>';

    expect(nextFocusableAfter(document, byId("a"), byId("a"))?.id).toBe("b");
  });
});

describe("popout island (DOM runtime)", () => {
  it("mount appends one surface and claims; a second mount is a no-op; destroy undoes both", () => {
    handle = mountPopouts(document);
    const again = mountPopouts(document);
    expect(document.querySelectorAll("dialog.popout").length).toBe(1);

    expect(document.documentElement.hasAttribute("data-island-popout")).toBe(
      true,
    );

    again.destroy();
    expect(document.querySelectorAll("dialog.popout").length).toBe(1);
    handle.destroy();
    handle = undefined;
    expect(document.querySelector("dialog.popout")).toBeNull();

    expect(document.documentElement.hasAttribute("data-island-popout")).toBe(
      false,
    );

    click(byId("t1"));
    expect(document.querySelector("dialog.popout")).toBeNull();
  });

  it("a click opens anchored, filled from that trigger's template", () => {
    handle = mountPopouts(document);
    click(byId("t1"));
    const s = surface();
    expect(s.open).toBe(true);
    expect(s.classList.contains("is-anchored")).toBe(true);
    expect(s.classList.contains("is-sheet")).toBe(false);
    expect(s.querySelector(".popout-label")?.textContent).toBe("Silk PLA");
    expect(s.querySelector(".popout-body a")?.getAttribute("href")).toBe("/x/");
    expect(byId("t1").getAttribute("aria-expanded")).toBe("true");
    expect(byId("t1").classList.contains("is-open")).toBe(true);
    expect(document.activeElement).toBe(s);
    expect(s.getAttribute("aria-labelledby")).toBe("popout-label");
    expect(s.getAttribute("aria-describedby")).toBe("popout-body");
    expect(s.querySelector(".popout-body")?.id).toBe("popout-body");
  });

  it("at phone width it opens as the sheet and locks the page", () => {
    stubPhone(true);
    handle = mountPopouts(document);
    click(byId("t1"));
    expect(surface().classList.contains("is-sheet")).toBe(true);

    expect(document.documentElement.classList.contains("popout-open")).toBe(
      true,
    );
  });

  it("clicking the open trigger closes it and it stays closed", () => {
    handle = mountPopouts(document);
    const t1 = byId("t1");
    click(t1);
    t1.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    click(t1);
    expect(surface().open).toBe(false);
    expect(t1.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(t1);
  });

  it("another trigger swaps the content; only one is ever open", () => {
    handle = mountPopouts(document);
    click(byId("t1"));
    click(byId("t2"));
    const s = surface();
    expect(s.open).toBe(true);
    expect(s.querySelector(".popout-label")?.textContent).toBe("Wood PLA");

    expect(s.querySelector(".popout-body")?.textContent).toBe(
      "Hardened nozzle.",
    );

    expect(byId("t1").getAttribute("aria-expanded")).toBe("false");
    expect(byId("t2").getAttribute("aria-expanded")).toBe("true");
  });

  it("a close event that lands after a reopen leaves the new popout alone", () => {
    handle = mountPopouts(document);
    click(byId("t1"));
    click(byId("t2"));
    /* Real browsers queue the close event; replay it late. */
    surface().dispatchEvent(new Event("close"));
    expect(surface().open).toBe(true);

    expect(surface().querySelector(".popout-label")?.textContent).toBe(
      "Wood PLA",
    );
  });

  it("the close box and Escape close and return focus to the trigger", () => {
    handle = mountPopouts(document);
    const t1 = byId("t1");

    const paths: (() => void)[] = [
      () => {
        const x = surface().querySelector(".popout-close");
        if (!(x instanceof HTMLElement)) throw new Error("no close box");
        click(x);
      },
      () => {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
      },
    ];

    for (const shut of paths) {
      click(t1);
      expect(surface().open).toBe(true);
      shut();
      expect(surface().open).toBe(false);

      expect(surface().querySelector(".popout-body")?.childNodes.length).toBe(
        0,
      );

      expect(t1.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(t1);
    }
  });

  it("automatic closes leave focus off the trigger", async () => {
    const t1 = byId("t1");
    const outside = byId("outside");
    outside.tabIndex = -1;

    const paths: [string, () => Promise<void>][] = [
      [
        "outside pointerdown",
        () => {
          outside.dispatchEvent(new Event("pointerdown", { bubbles: true }));
          return Promise.resolve();
        },
      ],
      [
        "scroll-away",
        async () => {
          offTop(t1);
          document.dispatchEvent(new Event("scroll"));
          await new Promise((r) => setTimeout(r, 5));
        },
      ],
      [
        "breakpoint-crossing resize",
        () => {
          stubWidth(768);
          view().dispatchEvent(new Event("resize"));
          return Promise.resolve();
        },
      ],
      [
        "focusout to an outside element",
        () => {
          outside.focus();
          return Promise.resolve();
        },
      ],
    ];

    await withTimerRaf(async () => {
      handle = mountPopouts(document);

      for (const [name, shut] of paths) {
        stubWidth(1280);
        Reflect.deleteProperty(t1, "getBoundingClientRect");
        t1.focus();
        click(t1);
        expect(surface().open, name).toBe(true);
        expect(document.activeElement, name).toBe(surface());
        await shut();
        expect(surface().open, name).toBe(false);
        expect(t1.getAttribute("aria-expanded"), name).toBe("false");
        expect(document.activeElement, name).not.toBe(t1);
        expect(surface().contains(document.activeElement), name).toBe(false);
      }
    });
  });

  it("focus moving to the open trigger or within the box keeps it open", () => {
    handle = mountPopouts(document);
    const t1 = byId("t1");
    click(t1);
    const inner = surface().querySelector(".popout-body a");
    if (!(inner instanceof HTMLElement)) throw new Error("no inner link");
    inner.focus();
    expect(surface().open).toBe(true);
    t1.focus();
    expect(surface().open).toBe(true);
  });

  it("a focusout with no destination closes, unless a press is under way", async () => {
    handle = mountPopouts(document);
    const t1 = byId("t1");

    /* Mid-press (Safari blurs before the click on a button lands): the
       pointer handlers own that close, so the focusout is ignored and
       the click still toggles the box shut rather than reopening it. */
    click(t1);
    t1.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    surface().blur();
    await Promise.resolve();
    expect(surface().open).toBe(true);
    click(t1);
    expect(surface().open).toBe(false);

    /* Keyboard focus leaving the document: close, focus not restored. */
    click(t1);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    surface().blur();
    await Promise.resolve();
    expect(surface().open).toBe(false);
    expect(document.activeElement).not.toBe(t1);
  });

  it("a pointercancel after pointerdown clears the press, so a later null-relatedTarget focusout still closes the box", async () => {
    handle = mountPopouts(document);
    const t1 = byId("t1");

    /* A touch pan ends in pointercancel, never a click. If the press
       flag outlives it, the next null-relatedTarget focusout (focus
       leaving to nowhere) is ignored forever and the box is stuck
       open. */
    click(t1);
    t1.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    t1.dispatchEvent(new Event("pointercancel", { bubbles: true }));
    surface().blur();
    await Promise.resolve();
    expect(surface().open).toBe(false);
    expect(document.activeElement).not.toBe(t1);
  });

  it("a tap that closes the open trigger is not undone by the focus dance in between", async () => {
    handle = mountPopouts(document);
    const t1 = byId("t1");

    /* Real tap order on the trigger that already has the box open:
       pointerdown, pointerup, then (a separate task) a focus change
       with nowhere to land, then the click. The press flag must
       survive pointerup here, or the queued focusout close beats the
       click to the punch: it shuts the box first, and the click that
       follows (seeing current === null) reopens it instead of closing
       it. */
    click(t1);
    const inner = surface().querySelector(".popout-body a");
    if (!(inner instanceof HTMLElement)) throw new Error("no inner link");
    inner.focus();

    t1.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    t1.dispatchEvent(new Event("pointerup", { bubbles: true }));
    inner.blur();
    await Promise.resolve();

    click(t1);
    expect(surface().open).toBe(false);
    await Promise.resolve();
    expect(surface().open).toBe(false);
  });

  it("a press inside the anchored box does not close it", () => {
    handle = mountPopouts(document);
    click(byId("t1"));
    const inner = surface().querySelector(".popout-body a");
    if (!(inner instanceof HTMLElement)) throw new Error("no inner link");
    inner.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(surface().open).toBe(true);
  });

  it("Shift+Tab from the close button closes the note and focuses the trigger", () => {
    handle = mountPopouts(document);
    byId("t1").click();
    const close = surface().querySelector<HTMLButtonElement>(".popout-close");
    close?.focus();

    close?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(surface().open).toBe(false);
    expect(document.activeElement?.id).toBe("t1");
  });

  it("Tab from the last link closes the note and focuses the next focusable after the trigger", () => {
    handle = mountPopouts(document);
    byId("t1").click();
    const inner = surface().querySelector<HTMLAnchorElement>(".popout-body a");
    inner?.focus();

    inner?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(surface().open).toBe(false);
    expect(document.activeElement?.id).toBe("t2");
  });

  it("Tab from the close button of a link-less note moves on past the trigger", () => {
    handle = mountPopouts(document);
    byId("t2").click();
    const close = surface().querySelector<HTMLButtonElement>(".popout-close");
    close?.focus();

    close?.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(surface().open).toBe(false);
    expect(document.activeElement?.id).toBe("bare");
  });

  it("focus leaving the trigger for the page closes an open note", () => {
    handle = mountPopouts(document);
    byId("t1").click();
    byId("t1").focus();

    byId("t1").dispatchEvent(
      new FocusEvent("focusout", {
        relatedTarget: byId("outside"),
        bubbles: true,
      }),
    );

    expect(surface().open).toBe(false);
  });

  it("the sheet closes on a backdrop click and a 60px swipe from the top", () => {
    stubPhone(true);
    handle = mountPopouts(document);
    const t1 = byId("t1");
    click(t1);
    /* A real backdrop tap is a pointerdown followed by a click, both
       targeting the dialog element itself. */
    surface().dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    click(surface());
    expect(surface().open).toBe(false);
    expect(document.activeElement).toBe(t1);

    expect(document.documentElement.classList.contains("popout-open")).toBe(
      false,
    );

    click(byId("t1"));
    surface().dispatchEvent(touch("touchstart", 100));
    surface().dispatchEvent(touch("touchend", 130));
    expect(surface().open).toBe(true);
    surface().dispatchEvent(touch("touchstart", 100));
    surface().dispatchEvent(touch("touchend", 170));
    expect(surface().open).toBe(false);
    expect(document.activeElement).toBe(t1);
  });

  it("a press that starts inside the sheet and ends on the backdrop does not close it", () => {
    stubPhone(true);
    handle = mountPopouts(document);
    byId("t1").click();
    const body = surface().querySelector(".popout-body");
    body?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    surface().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(surface().open).toBe(true);
  });

  it("a press and click both on the backdrop closes the sheet", () => {
    stubPhone(true);
    handle = mountPopouts(document);
    byId("t1").click();
    surface().dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    surface().dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(surface().open).toBe(false);
  });

  it("the sheet survives a resize that stays phone; a breakpoint crossing closes it", () => {
    stubPhone(true);
    handle = mountPopouts(document);
    click(byId("t1"));
    view().dispatchEvent(new Event("resize"));
    expect(surface().open).toBe(true);
    stubPhone(false);
    view().dispatchEvent(new Event("resize"));
    expect(surface().open).toBe(false);
  });

  it("the anchored popout survives a resize that stays desktop; a breakpoint crossing to phone closes it", () => {
    stubWidth(1280);
    handle = mountPopouts(document);
    click(byId("t1"));
    expect(surface().classList.contains("is-anchored")).toBe(true);
    view().dispatchEvent(new Event("resize"));
    expect(surface().open).toBe(true);
    stubWidth(700);
    view().dispatchEvent(new Event("resize"));
    expect(surface().open).toBe(false);
  });

  it("scrolling the trigger wholly out of view closes the anchored box", async () => {
    await withTimerRaf(async () => {
      handle = mountPopouts(document);
      const t1 = byId("t1");
      click(t1);
      offTop(t1);
      document.dispatchEvent(new Event("scroll"));
      await new Promise((r) => setTimeout(r, 5));
      expect(surface().open).toBe(false);
    });
  });

  it("the mode flips at the phone breakpoint: 768 is the sheet, 769 anchored", () => {
    handle = mountPopouts(document);
    const t1 = byId("t1");

    stubWidth(768);
    click(t1);
    expect(surface().classList.contains("is-sheet")).toBe(true);
    expect(surface().classList.contains("is-anchored")).toBe(false);
    click(t1);

    stubWidth(769);
    click(t1);
    expect(surface().classList.contains("is-anchored")).toBe(true);
    expect(surface().classList.contains("is-sheet")).toBe(false);
  });

  it("after destroy a trigger click changes nothing", () => {
    handle = mountPopouts(document);
    handle.destroy();
    handle = undefined;
    click(byId("t1"));
    expect(byId("t1").getAttribute("aria-expanded")).toBe("false");
  });

  it("a trigger with no template does nothing", () => {
    handle = mountPopouts(document);

    expect(() => {
      click(byId("bare"));
    }).not.toThrow();

    expect(surface().open).toBe(false);
  });

  it("honors a custom selector and close label", () => {
    document.body.innerHTML =
      '<button type="button" class="my-note" id="m" data-popout-label="M">n</button><template>hi</template>';

    handle = mountPopouts(document, {
      selector: ".my-note",
      closeLabel: "Dismiss",
    });

    click(byId("m"));
    expect(surface().open).toBe(true);

    expect(
      surface().querySelector(".popout-close")?.getAttribute("aria-label"),
    ).toBe("Dismiss");
  });
});
