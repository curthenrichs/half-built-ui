/* The plate frame's enlarge box (0.16.0). The .plate-frame pattern
   (css 0.15.0) draws the plate modal's frame inline and puts an icon box
   with .plate-frame-corner on the plate's corner; this makes that box
   open the full view. The frame's [data-plate-frame-content] element
   moves into the plate modal whole, so a live element (a polling
   monitor, a running demo) keeps working there, and a slot of the same
   height holds its place in the page. The frame stays behind with
   .is-popped, which hides its corner box. Every way out (close box,
   veil, Escape) fires the dialog's close event, which moves the content
   back and returns focus to the corner box. The plate is built on first
   use and kept.

   Per frame, optional: data-plate-label names the dialog (default
   "Enlarged view"), and data-plate-class adds classes to the modal's
   plate and data-zone-class to its zone, for consumer sizing. */
import { buildPlateModal, type PlateModalRefs } from "./plate-modal";

function mountOne(frame: HTMLElement): { destroy(): void } {
  const content = frame.querySelector("[data-plate-frame-content]");
  const btn = frame.querySelector(".plate-frame-corner");

  if (
    !(content instanceof HTMLElement) ||
    !(btn instanceof HTMLButtonElement)
  ) {
    return {
      destroy() {
        /* no content or no corner box, nothing mounted */
      },
    };
  }

  const doc = frame.ownerDocument;
  let pm: PlateModalRefs | undefined;
  let slot: HTMLElement | undefined;

  const putBack = (): void => {
    if (!slot) return;
    slot.replaceWith(content);
    slot = undefined;
    frame.classList.remove("is-popped");
    /* The package returns focus before the content is back, while the
       corner box is still hidden in the frame, so focus it again. */
    btn.focus();
  };

  const classes = (attr: string): string[] =>
    (frame.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean);

  const plate = (): PlateModalRefs => {
    if (pm) return pm;

    pm = buildPlateModal(doc, {
      ariaLabel: frame.dataset.plateLabel ?? "Enlarged view",
    });

    const plateClasses = classes("data-plate-class");
    const zoneClasses = classes("data-zone-class");
    if (plateClasses.length) pm.plate.classList.add(...plateClasses);
    if (zoneClasses.length) pm.zone.classList.add(...zoneClasses);
    pm.dialog.addEventListener("close", putBack);
    return pm;
  };

  const onClick = (): void => {
    if (slot) return;
    const refs = plate();
    slot = doc.createElement("div");
    slot.style.height = `${String(content.getBoundingClientRect().height)}px`;
    content.before(slot);
    frame.classList.add("is-popped");
    refs.plate.append(content);
    refs.open(btn);
  };

  btn.addEventListener("click", onClick);

  return {
    destroy(): void {
      btn.removeEventListener("click", onClick);
      if (pm?.isOpen()) pm.close();
      putBack();
      pm?.dialog.remove();
      pm = undefined;
    },
  };
}

/* Mounts every .plate-frame under root that has a corner box and a
   [data-plate-frame-content] element. */
export function mountPlateFrames(root: ParentNode): { destroy(): void } {
  const mounted = [...root.querySelectorAll(".plate-frame")]
    .filter((f): f is HTMLElement => f instanceof HTMLElement)
    .map(mountOne);

  return {
    destroy(): void {
      for (const m of mounted) m.destroy();
    },
  };
}
