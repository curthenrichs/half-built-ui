/* Shared plate-window chrome (spec
   docs/superpowers/specs/2026-08-22-fluid-path-player-design.md):
   dialog + veil, corner-stroked zone, ink plate, boxed labels, close.
   Consumers: the image lightbox (legacyPrefix "lb" keeps its old class
   names alive) and the path player. */

import { ICON_X } from "./core/icons";

export interface PlateModalRefs {
  dialog: HTMLDialogElement;
  zone: HTMLDivElement;
  plate: HTMLDivElement;
  closeBtn: HTMLButtonElement;
  addLabel: (
    pos: "topLeft" | "bottomLeft" | "bottomRight",
    className?: string,
  ) => HTMLSpanElement;
  open: (opener: HTMLElement | null) => void;
  close: () => void;
  isOpen: () => boolean;
}

const POS_CLASS = {
  topLeft: "pm-label-tl",
  bottomLeft: "pm-label-bl",
  bottomRight: "pm-label-br",
} as const;

export function buildPlateModal(
  doc: Document,
  opts: { ariaLabel: string; legacyPrefix?: string; closeLabel?: string },
): PlateModalRefs {
  const { closeLabel = "Close" } = opts;

  const legacy = (name: string): string[] =>
    opts.legacyPrefix
      ? [`pm-${name}`, `${opts.legacyPrefix}-${name}`]
      : [`pm-${name}`];

  const dialog = doc.createElement("dialog");
  dialog.classList.add(...legacy("dialog"));
  dialog.setAttribute("aria-label", opts.ariaLabel);

  const zone = doc.createElement("div");
  zone.classList.add(...legacy("zone"));

  for (const c of ["tl", "tr", "bl", "br"]) {
    const corner = doc.createElement("div");
    corner.classList.add(...legacy("corner"), ...legacy(`c-${c}`));
    zone.append(corner);
  }

  const plate = doc.createElement("div");
  plate.classList.add(...legacy("plate"), "bracket-frame");

  const closeBtn = doc.createElement("button");
  closeBtn.type = "button";
  closeBtn.classList.add(...legacy("close"), "icon-box");
  closeBtn.setAttribute("aria-label", closeLabel);
  closeBtn.innerHTML = ICON_X;
  plate.append(closeBtn);

  zone.append(plate);
  dialog.append(zone);
  doc.body.append(dialog);

  let opener: HTMLElement | null = null;
  /* The page scroll lock (overflow: hidden via html.pm-open, see
     plate-modal.css). Cleared on the dialog's close event so every
     path out (close box, veil click, Escape, a consumer's close())
     unlocks it. */
  const root = doc.documentElement;

  closeBtn.addEventListener("click", () => {
    dialog.close();
  });

  dialog.addEventListener("close", () => {
    root.classList.remove("pm-open");
    opener?.focus();
  });

  /* The dialog fills the viewport; a veil click targets the dialog
     element itself (everything inside the zone targets a descendant).
     Checked by identity, not zone.contains: a handler that swaps a
     button's innerHTML detaches the click's target mid-bubble, and a
     detached node is contained by nothing, which read as a veil click
     and closed the dialog under the pause button (found 2026-08-23). */
  dialog.addEventListener("click", (ev) => {
    if (ev.target === dialog) dialog.close();
  });

  const addLabel = (
    pos: "topLeft" | "bottomLeft" | "bottomRight",
    className?: string,
  ): HTMLSpanElement => {
    const span = doc.createElement("span");

    span.classList.add(
      "pm-label",
      POS_CLASS[pos],
      "boxed-label",
      "micro-label",
    );

    if (className) span.classList.add(...className.split(" "));
    plate.append(span);
    return span;
  };

  return {
    dialog,
    zone,
    plate,
    closeBtn,
    addLabel,
    open: (o) => {
      opener = o;
      dialog.showModal();
      root.classList.add("pm-open");
    },
    close: () => {
      dialog.close();
    },
    isOpen: () => dialog.open,
  };
}
