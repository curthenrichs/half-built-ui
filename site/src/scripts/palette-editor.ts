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
  "--brand-1-300",
  "--brand-1-500",
  "--brand-1-vivid",
  "--brand-1-600",
  "--brand-1-700",
  "--brand-2-300",
  "--brand-2-500",
  "--brand-2-700",
  "--code-bg",
  "--code-line",
  "--code-fg",
  "--code-token-comment",
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

/* One status line, not an instrument panel (owner call 2026-09-06:
   raw ratios read as unstructured noise). Only the dark-text check can
   warn, because the picked bases become literal text in the dark
   theme; every derived stop is contrast-gated by construction, so when
   both bases pass there is nothing else worth saying. A warning line
   carries warn: true so the panel can ink it as one (site.css's
   .site-toolbar-warn, var(--error-ink) in both themes). */
interface StatusLine {
  text: string;
  warn: boolean;
}

function statusLines(base1: BaseReadout, base2: BaseReadout): StatusLine[] {
  const warnings: StatusLine[] = [];
  if (!base1.darkTextPasses) {
    warnings.push({ text: "Accent 1 is too dark to read as text on the dark theme, consider a lighter shade.", warn: true });
  }
  if (!base2.darkTextPasses) {
    warnings.push({ text: "Accent 2 is too dark to read as text on the dark theme, consider a lighter shade.", warn: true });
  }
  return warnings.length > 0 ? warnings : [{ text: "Contrast checks pass.", warn: false }];
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
  detailList: HTMLUListElement;
  pre: HTMLPreElement;
  copyBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
}

/* The numbers live behind the Show details disclosure (owner call
   2026-09-06): the status line answers "is it ok", these answer "by
   how much". Each accent is a label line with its two ratios as
   nowrap <code> chips on their own indented lines beneath it (owner
   call 2026-09-06), so a figure never wraps through its middle. */
function fillStatus(doc: Document, list: HTMLUListElement, lines: StatusLine[]): void {
  list.innerHTML = "";
  for (const line of lines) {
    const li = doc.createElement("li");
    li.textContent = line.text;
    if (line.warn) li.classList.add("site-toolbar-warn");
    list.append(li);
  }
}

function ratioChip(doc: Document, text: string): HTMLElement {
  const code = doc.createElement("code");
  code.textContent = text;
  return code;
}

function fillDetail(doc: Document, list: HTMLUListElement, base1: BaseReadout, base2: BaseReadout): void {
  list.innerHTML = "";
  const rows: [string, BaseReadout][] = [["Accent 1", base1], ["Accent 2", base2]];
  for (const [label, r] of rows) {
    const labelLi = doc.createElement("li");
    labelLi.textContent = label;
    list.append(labelLi);
    const chips = [
      `text on dark ${r.darkTextRatio.toFixed(2)}:1`,
      `fill on light ${r.lightFillRatio.toFixed(2)}:1`,
    ];
    for (const text of chips) {
      const li = doc.createElement("li");
      li.classList.add("site-toolbar-indent");
      li.append(ratioChip(doc, text));
      list.append(li);
    }
  }
}

function render(doc: Document, els: EditorElements, b1: string, b2: string): PaletteOverride {
  const derived = derivePalette(b1, b2);
  const readouts = readBases(b1, b2);
  fillStatus(doc, els.readoutsList, statusLines(readouts.base1, readouts.base2));
  /* Ratio lines render as inline code (owner call 2026-09-06). */
  fillDetail(doc, els.detailList, readouts.base1, readouts.base2);
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
  const detailList = editor.querySelector<HTMLUListElement>("[data-palette-detail]");
  const pre = editor.querySelector<HTMLPreElement>("[data-palette-css]");
  const copyBtn = editor.querySelector<HTMLButtonElement>("[data-palette-copy]");
  const resetBtn = editor.querySelector<HTMLButtonElement>("[data-palette-reset]");
  if (!input1 || !input2 || !readoutsList || !detailList || !pre || !copyBtn || !resetBtn) return;
  const els: EditorElements = { input1, input2, readoutsList, detailList, pre, copyBtn, resetBtn };

  const storage = safeStorage(root);
  const html = root.documentElement;

  /* The chip whose two bases are the live pair reads aria-pressed, so
     the panel shows which preset (if any) is in effect; a manual pick
     that matches none clears every chip. Kept in step by every path
     that changes the pair, including mount and reset. */
  const presets = [...editor.querySelectorAll<HTMLButtonElement>("[data-palette-preset]")];
  const syncPresets = (b1: string, b2: string): void => {
    for (const btn of presets) {
      const active =
        btn.getAttribute("data-base-1")?.toLowerCase() === b1.toLowerCase() &&
        btn.getAttribute("data-base-2")?.toLowerCase() === b2.toLowerCase();
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    }
  };

  const apply = (b1: string, b2: string): void => {
    applyPalette(root, els, html, storage, storageKey, b1, b2);
    syncPresets(b1, b2);
  };

  const stored = readStored(storage, storageKey);
  if (stored) {
    setInputs(els, stored.b1, stored.b2);
    apply(stored.b1, stored.b2);
  } else {
    setInputs(els, AMBER_B1, AMBER_B2);
    render(root, els, AMBER_B1, AMBER_B2);
    syncPresets(AMBER_B1, AMBER_B2);
  }

  const onBaseInput = (): void => {
    apply(els.input1.value, els.input2.value);
  };
  els.input1.addEventListener("input", onBaseInput);
  els.input2.addEventListener("input", onBaseInput);

  editor.querySelectorAll<HTMLButtonElement>("[data-palette-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      /* data-base-1/data-base-2 do reflect into .dataset, but under the
         literal key "base-1"/"base-2": the camelCase mapping only
         triggers on a hyphen followed by a lowercase letter, and a
         hyphen followed by a digit is left alone. getAttribute is
         still the right call here. */
      const b1 = btn.getAttribute("data-base-1");
      const b2 = btn.getAttribute("data-base-2");
      if (!b1 || !b2) return;
      setInputs(els, b1, b2);
      apply(b1, b2);
    });
  });

  /* Popup manners (owner call 2026-09-06, matching the plate modal's
     conventions): the corner X, a click outside the panel, or Escape
     all close it. The details element is the open/closed state. */
  const closePanel = (): void => {
    if (editor instanceof HTMLDetailsElement) editor.open = false;
  };
  const closeBtn = editor.querySelector<HTMLButtonElement>("[data-palette-close]");
  closeBtn?.addEventListener("click", closePanel);
  root.addEventListener("click", (e) => {
    if (!(editor instanceof HTMLDetailsElement) || !editor.open) return;
    if (e.target instanceof Node && !editor.contains(e.target)) closePanel();
  });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePanel();
  });

  const flipBtn = editor.querySelector<HTMLButtonElement>("[data-palette-flip]");
  flipBtn?.addEventListener("click", () => {
    const b1 = els.input2.value;
    const b2 = els.input1.value;
    setInputs(els, b1, b2);
    apply(b1, b2);
  });

  els.resetBtn.addEventListener("click", () => {
    clearStored(storage, storageKey);
    for (const key of RAMP_KEYS) {
      html.style.removeProperty(key);
    }
    setInputs(els, AMBER_B1, AMBER_B2);
    render(root, els, AMBER_B1, AMBER_B2);
    syncPresets(AMBER_B1, AMBER_B2);
  });

  const copyLabel = els.copyBtn.textContent;
  els.copyBtn.addEventListener("click", () => {
    const text = els.pre.textContent;
    void navigator.clipboard.writeText(text).then(() => {
      els.copyBtn.textContent = "Copied";
      setTimeout(() => {
        els.copyBtn.textContent = copyLabel;
      }, 1500);
    }).catch(() => {
      els.copyBtn.textContent = "Copy failed";
      setTimeout(() => {
        els.copyBtn.textContent = copyLabel;
      }, 1500);
    });
  });
}
