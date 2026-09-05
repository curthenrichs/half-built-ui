/* The palette editor island (Task 5): the fixed toolbar's live control
   for the two accent bases. Pure DOM plus Task 3's derivation
   (derivePalette/readBases/overrideBlock); state is only { b1, b2 }.
   Site-local, like toc.ts, not a package island: this page's
   Toolbar.astro is the only consumer.

   apply() is the "this is a real, user-picked palette" path: it
   derives the ramp, paints the readouts and the copyable css, sets the
   six custom properties inline on <html> so the whole page re-themes,
   and persists the pair. render() is the display-only half of that
   (readouts + <pre>, no properties, no storage) used for the plain
   default state and by reset, so the panel still shows correct numbers
   for the amber anchor without claiming an override is in effect that
   the package's own default tokens already provide. */
import { derivePalette, readBases, overrideBlock, type PaletteOverride, type BaseReadout } from "../lib/derive-palette";

const HEX_RE = /^#[0-9a-f]{6}$/i;

const AMBER_B1 = "#ffaa3c";
const AMBER_B2 = "#3cc7dd";

const RAMP_KEYS: (keyof PaletteOverride)[] = [
  "--brand-1-500",
  "--brand-1-600",
  "--brand-1-700",
  "--brand-2-300",
  "--brand-2-500",
  "--brand-2-700",
];

export interface PaletteEditorOptions {
  storageKey: string;
}

interface StoredPalette {
  b1: string;
  b2: string;
}

function isStoredPalette(v: unknown): v is StoredPalette {
  if (typeof v !== "object" || v === null) return false;
  const rec = v as Record<string, unknown>;
  return (
    typeof rec.b1 === "string" &&
    typeof rec.b2 === "string" &&
    HEX_RE.test(rec.b1) &&
    HEX_RE.test(rec.b2)
  );
}

/* Every storage access is guarded: localStorage can throw in a private
   window or with site data blocked, and a missing/garbled value simply
   reads as "nothing stored" rather than a crash. */
function readStored(storage: Storage | null, key: string): StoredPalette | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredPalette(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStored(storage: Storage | null, key: string, b1: string, b2: string): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify({ b1, b2 }));
  } catch {
    /* the choice lives for this page only */
  }
}

function clearStored(storage: Storage | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* nothing to clear if the store refused the write in the first place */
  }
}

function safeStorage(doc: Document): Storage | null {
  try {
    return doc.defaultView?.localStorage ?? null;
  } catch {
    return null;
  }
}

function readoutLine(label: string, r: BaseReadout): string {
  const darkText = r.darkTextPasses
    ? `dark text ${r.darkTextRatio.toFixed(2)}:1, pass`
    : `dark text ${r.darkTextRatio.toFixed(2)}:1. Too dark to read as text on the dark theme, consider a lighter shade.`;
  const lightFill = r.lightFillPasses
    ? `light fill ${r.lightFillRatio.toFixed(2)}:1, pass`
    : `light fill ${r.lightFillRatio.toFixed(2)}:1. Too faint for lines and fills on the light theme, consider a stronger shade.`;
  return `${label}: ${darkText}; ${lightFill}`;
}

/* The five controls plus the readout/css targets, bundled once the
   guard below confirms every one exists. A plain nullable local
   narrowed by that guard loses its non-null type the moment a nested
   closure captures it (TypeScript cannot prove the closure runs only
   after the guard), so the handlers below take this fixed-shape
   object instead of closing over the original querySelector results. */
interface EditorElements {
  input1: HTMLInputElement;
  input2: HTMLInputElement;
  readoutsList: HTMLUListElement;
  pre: HTMLPreElement;
  copyBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
}

function render(doc: Document, els: EditorElements, b1: string, b2: string): PaletteOverride {
  const derived = derivePalette(b1, b2);
  const readouts = readBases(b1, b2);
  els.readoutsList.innerHTML = "";
  const li1 = doc.createElement("li");
  li1.textContent = readoutLine("Accent 1", readouts.base1);
  const li2 = doc.createElement("li");
  li2.textContent = readoutLine("Accent 2", readouts.base2);
  els.readoutsList.append(li1, li2);
  els.pre.textContent = overrideBlock(derived);
  return derived;
}

function applyPalette(
  doc: Document,
  els: EditorElements,
  html: HTMLElement,
  storage: Storage | null,
  storageKey: string,
  b1: string,
  b2: string,
): void {
  const derived = render(doc, els, b1, b2);
  for (const key of RAMP_KEYS) {
    html.style.setProperty(key, derived[key]);
  }
  writeStored(storage, storageKey, b1, b2);
}

function setInputs(els: EditorElements, b1: string, b2: string): void {
  els.input1.value = b1;
  els.input2.value = b2;
}

export function mountPaletteEditor(root: Document, opts: PaletteEditorOptions): void {
  const { storageKey } = opts;
  const editor = root.querySelector<HTMLElement>("[data-palette-editor]");
  if (!editor) return;
  const input1 = editor.querySelector<HTMLInputElement>('input[data-palette-base="1"]');
  const input2 = editor.querySelector<HTMLInputElement>('input[data-palette-base="2"]');
  const readoutsList = editor.querySelector<HTMLUListElement>("[data-palette-readouts]");
  const pre = editor.querySelector<HTMLPreElement>("[data-palette-css]");
  const copyBtn = editor.querySelector<HTMLButtonElement>("[data-palette-copy]");
  const resetBtn = editor.querySelector<HTMLButtonElement>("[data-palette-reset]");
  if (!input1 || !input2 || !readoutsList || !pre || !copyBtn || !resetBtn) return;
  const els: EditorElements = { input1, input2, readoutsList, pre, copyBtn, resetBtn };

  const storage = safeStorage(root);
  const html = root.documentElement;
  const apply = (b1: string, b2: string): void => {
    applyPalette(root, els, html, storage, storageKey, b1, b2);
  };

  const stored = readStored(storage, storageKey);
  if (stored) {
    setInputs(els, stored.b1, stored.b2);
    apply(stored.b1, stored.b2);
  } else {
    setInputs(els, AMBER_B1, AMBER_B2);
    render(root, els, AMBER_B1, AMBER_B2);
  }

  const onBaseInput = (): void => {
    apply(els.input1.value, els.input2.value);
  };
  els.input1.addEventListener("input", onBaseInput);
  els.input2.addEventListener("input", onBaseInput);

  editor.querySelectorAll<HTMLButtonElement>("[data-palette-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      /* data-base-1/data-base-2: a hyphen followed by a digit does not
         reflect into .dataset (the spec's camelCase mapping is
         ambiguous there), so these are read via getAttribute. */
      const b1 = btn.getAttribute("data-base-1");
      const b2 = btn.getAttribute("data-base-2");
      if (!b1 || !b2) return;
      setInputs(els, b1, b2);
      apply(b1, b2);
    });
  });

  els.resetBtn.addEventListener("click", () => {
    clearStored(storage, storageKey);
    for (const key of RAMP_KEYS) {
      html.style.removeProperty(key);
    }
    setInputs(els, AMBER_B1, AMBER_B2);
    render(root, els, AMBER_B1, AMBER_B2);
  });

  const copyLabel = els.copyBtn.textContent;
  els.copyBtn.addEventListener("click", () => {
    const text = els.pre.textContent;
    void navigator.clipboard.writeText(text).then(() => {
      els.copyBtn.textContent = "Copied";
      setTimeout(() => {
        els.copyBtn.textContent = copyLabel;
      }, 1500);
    });
  });
}
