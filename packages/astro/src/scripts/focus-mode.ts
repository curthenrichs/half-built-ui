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

export const mountFocusMode: Island<FocusModeOptions> = (
  root,
  options = {},
): IslandHandle => {
  const el = root as HTMLElement;
  const target = options.target ?? window;

  if (!claim(el, "focus-mode")) {
    return {
      destroy(): void {
        /* already claimed elsewhere: nothing here to tear down */
        return;
      },
    };
  }

  const onKeydown = (): void => {
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
