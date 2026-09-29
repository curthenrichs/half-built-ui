import { claim, release, type Island, type IslandHandle } from "./core/island";

/* How did focus arrive: keyboard or pointer. A text field matches
   :focus-visible on a mouse click as well as on a Tab, so CSS alone
   cannot give the joined field its own click highlight while keeping
   the site-wide keyboard ring (owner rule 2026-08-26). Stamps
   data-focus="keyboard" | "pointer" on the root; patterns.css reads it.
   Package-bound (owner decision 2, 2026-08-31): patterns.css keys on
   the stamp this island writes. */

export interface FocusModeOptions {
  /* What to listen on, capture: true, as today. Defaults to window so a
     keydown or pointerdown anywhere in the document is caught before it
     reaches the target that would otherwise show its own focus ring. */
  target?: EventTarget;
}

/* Text entry is not navigation: a reader who clicked into a field and
   types keeps the click highlight. Tab always means keyboard. */
function isTextEntry(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;

  if (
    t.isContentEditable ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement
  ) {
    return true;
  }

  if (!(t instanceof HTMLInputElement)) return false;

  return ![
    "checkbox",
    "radio",
    "button",
    "submit",
    "reset",
    "range",
    "color",
    "file",
    "image",
  ].includes(t.type);
}

export const mountFocusMode: Island<FocusModeOptions> = (
  root,
  options = {},
): IslandHandle => {
  const el =
    root instanceof Document ? root.documentElement : (root as HTMLElement);

  const target = options.target ?? window;

  if (!claim(el, "focus-mode")) {
    return {
      destroy(): void {
        /* already claimed elsewhere: nothing here to tear down */
        return;
      },
    };
  }

  const onKeydown = (ev: Event): void => {
    if (!(ev instanceof KeyboardEvent)) return;
    if (ev.key !== "Tab" && isTextEntry(ev.target)) return;
    el.dataset.focus = "keyboard";
  };

  const onPointerdown = (): void => {
    el.dataset.focus = "pointer";
  };

  target.addEventListener("keydown", onKeydown, true);
  target.addEventListener("pointerdown", onPointerdown, true);

  return {
    destroy(): void {
      target.removeEventListener("keydown", onKeydown, true);
      target.removeEventListener("pointerdown", onPointerdown, true);
      release(el, "focus-mode");
    },
  };
};
