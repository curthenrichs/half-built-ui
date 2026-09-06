// @vitest-environment jsdom
/* The palette-editor island (Task 5): a fixed toolbar panel that lets a
   visitor pick two accent bases, derives the six ramp stops through
   Task 3's derivePalette, and applies them live as inline custom
   properties on <html> so the whole demo site re-themes without a
   reload. Mirrors the jsdom conventions in
   packages/astro/test/theme-toggle-dom.test.ts: real localStorage,
   fireEvent-style dispatch, one describe block. */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mountPaletteEditor } from "../src/scripts/palette-editor";
import { derivePalette, overrideBlock } from "../src/lib/derive-palette";

const KEY = "test-palette-key";

const RAMP_KEYS = [
  "--brand-1-500",
  "--brand-1-600",
  "--brand-1-700",
  "--brand-2-300",
  "--brand-2-500",
  "--brand-2-700",
] as const;

const AMBER_B1 = "#ffaa3c";
const AMBER_B2 = "#3cc7dd";

function fixture(): void {
  document.body.innerHTML = `
    <aside class="site-toolbar">
      <details data-palette-editor>
        <summary>Palette</summary>
        <button type="button" data-palette-close>X</button>
        <label for="palette-base-1">Accent 1</label>
        <input type="color" id="palette-base-1" data-palette-base="1" value="${AMBER_B1}" />
        <label for="palette-base-2">Accent 2</label>
        <input type="color" id="palette-base-2" data-palette-base="2" value="${AMBER_B2}" />
        <button type="button" data-palette-flip>Flip</button>
        <ul data-palette-readouts></ul>
        <details><summary>Show details</summary><ul data-palette-detail></ul></details>
        <button type="button" data-palette-preset data-base-1="${AMBER_B1}" data-base-2="${AMBER_B2}">Amber</button>
        <button type="button" data-palette-preset data-base-1="#1890ff" data-base-2="#13c2c2">Blues</button>
        <button type="button" data-palette-preset data-base-1="#2f9e44" data-base-2="#0ca678">Greens</button>
        <details><summary>Show CSS</summary><pre data-palette-css></pre></details>
        <button type="button" data-palette-copy>Copy CSS</button>
        <button type="button" data-palette-reset>Reset</button>
      </details>
    </aside>`;
}

function input(id: string): HTMLInputElement {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLInputElement)) throw new Error(`no input#${id}`);
  return el;
}

function fireInput(el: HTMLInputElement, value: string): void {
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function computedProps(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of RAMP_KEYS) {
    out[key] = document.documentElement.style.getPropertyValue(key).trim();
  }
  return out;
}

beforeEach(() => {
  document.documentElement.removeAttribute("style");
  fixture();
  localStorage.clear();
});

describe("palette editor", () => {
  it("picking a base sets all six properties and persists the pair", () => {
    mountPaletteEditor(document, { storageKey: KEY });
    fireInput(input("palette-base-1"), "#2f9e44");
    fireInput(input("palette-base-2"), "#0ca678");

    const derived = derivePalette("#2f9e44", "#0ca678");
    expect(computedProps()).toEqual(derived);

    const stored = JSON.parse(localStorage.getItem(KEY) ?? "null") as { b1: string; b2: string } | null;
    expect(stored).toEqual({ b1: "#2f9e44", b2: "#0ca678" });
  });

  it("a preset click routes through the same path", () => {
    mountPaletteEditor(document, { storageKey: KEY });
    const preset = document.querySelector<HTMLButtonElement>('[data-palette-preset][data-base-1="#1890ff"]');
    if (!preset) throw new Error("no portfolio preset");
    preset.click();

    const derived = derivePalette("#1890ff", "#13c2c2");
    expect(computedProps()).toEqual(derived);
    expect(input("palette-base-1").value).toBe("#1890ff");
    expect(input("palette-base-2").value).toBe("#13c2c2");
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "null") as { b1: string; b2: string } | null;
    expect(stored).toEqual({ b1: "#1890ff", b2: "#13c2c2" });
  });

  it("reset removes all six properties and the storage key", () => {
    mountPaletteEditor(document, { storageKey: KEY });
    fireInput(input("palette-base-1"), "#2f9e44");
    fireInput(input("palette-base-2"), "#0ca678");
    expect(localStorage.getItem(KEY)).not.toBeNull();

    document.querySelector<HTMLButtonElement>("[data-palette-reset]")?.click();

    for (const key of RAMP_KEYS) {
      expect(document.documentElement.style.getPropertyValue(key)).toBe("");
    }
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(input("palette-base-1").value).toBe(AMBER_B1);
    expect(input("palette-base-2").value).toBe(AMBER_B2);
  });

  it("the <pre> shows the current override block", () => {
    mountPaletteEditor(document, { storageKey: KEY });
    fireInput(input("palette-base-1"), "#2f9e44");
    fireInput(input("palette-base-2"), "#0ca678");

    const pre = document.querySelector("[data-palette-css]");
    expect(pre?.textContent).toBe(overrideBlock(derivePalette("#2f9e44", "#0ca678")));
  });

  it("readouts carry a warning sentence when a base fails darkTextPasses", () => {
    mountPaletteEditor(document, { storageKey: KEY });
    fireInput(input("palette-base-1"), "#104020");
    fireInput(input("palette-base-2"), "#3cc7dd");

    const readouts = document.querySelector("[data-palette-readouts]");
    expect(readouts?.textContent).toContain(
      "Accent 1 is too dark to read as text on the dark theme, consider a lighter shade.",
    );
  });

  it("shows one quiet pass line when both bases clear the gate", () => {
    mountPaletteEditor(document, { storageKey: KEY });
    /* near-white passes as dark-ground text and sits under 3:1 as a
       light-paper fill, exactly like the shipped defaults do; neither
       fact warrants a warning or a raw ratio (owner call 2026-09-06:
       no instrument panel). */
    fireInput(input("palette-base-1"), "#fafafa");
    fireInput(input("palette-base-2"), "#3cc7dd");

    const readouts = document.querySelector("[data-palette-readouts]");
    expect(readouts?.textContent).toBe("Contrast checks pass.");
  });

  it("the corner X, an outside click, and Escape each close the panel", () => {
    mountPaletteEditor(document, { storageKey: KEY });
    const details = document.querySelector<HTMLDetailsElement>("[data-palette-editor]");
    if (!details) throw new Error("no editor details");

    details.open = true;
    document.querySelector<HTMLButtonElement>("[data-palette-close]")?.click();
    expect(details.open).toBe(false);

    details.open = true;
    document.body.click();
    expect(details.open).toBe(false);

    details.open = true;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(details.open).toBe(false);

    /* a click inside stays open */
    details.open = true;
    input("palette-base-1").click();
    expect(details.open).toBe(true);
  });

  it("flip swaps the two bases through the normal apply path", () => {
    mountPaletteEditor(document, { storageKey: KEY });
    fireInput(input("palette-base-1"), "#1890ff");
    fireInput(input("palette-base-2"), "#13c2c2");

    const flip = document.querySelector<HTMLButtonElement>("[data-palette-flip]");
    flip?.click();

    expect(document.documentElement.style.getPropertyValue("--brand-1-500")).toBe("#13c2c2");
    expect(document.documentElement.style.getPropertyValue("--brand-2-500")).toBe("#1890ff");
    expect(input("palette-base-1").value).toBe("#13c2c2");
    expect(input("palette-base-2").value).toBe("#1890ff");
  });

  it("the details disclosure carries the per-accent ratios", () => {
    mountPaletteEditor(document, { storageKey: KEY });
    fireInput(input("palette-base-1"), "#fafafa");
    fireInput(input("palette-base-2"), "#3cc7dd");

    const detail = document.querySelector("[data-palette-detail]");
    expect(detail?.textContent).toMatch(/Accent 1: text on dark \d+\.\d\d:1, fill on light \d+\.\d\d:1/);
    expect(detail?.textContent).toContain("Accent 2:");
  });

  it("a fresh mount with storage populated re-applies the palette", () => {
    localStorage.setItem(KEY, JSON.stringify({ b1: "#2f9e44", b2: "#0ca678" }));
    mountPaletteEditor(document, { storageKey: KEY });

    const derived = derivePalette("#2f9e44", "#0ca678");
    expect(computedProps()).toEqual(derived);
    expect(input("palette-base-1").value).toBe("#2f9e44");
    expect(input("palette-base-2").value).toBe("#0ca678");
  });

  it("a fresh mount with no storage renders the amber default but sets no override properties", () => {
    mountPaletteEditor(document, { storageKey: KEY });
    for (const key of RAMP_KEYS) {
      expect(document.documentElement.style.getPropertyValue(key)).toBe("");
    }
    const pre = document.querySelector("[data-palette-css]");
    expect(pre?.textContent).toBe(overrideBlock(derivePalette(AMBER_B1, AMBER_B2)));
  });

  it("copy sends the <pre> text through the clipboard and confirms on the button", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    mountPaletteEditor(document, { storageKey: KEY });
    fireInput(input("palette-base-1"), "#2f9e44");
    fireInput(input("palette-base-2"), "#0ca678");

    const pre = document.querySelector("[data-palette-css]");
    const copyBtn = document.querySelector<HTMLButtonElement>("[data-palette-copy]");
    if (!copyBtn) throw new Error("no copy button");
    copyBtn.click();
    expect(writeText).toHaveBeenCalledWith(pre?.textContent);

    await Promise.resolve();
    await Promise.resolve();
    expect(copyBtn.textContent).toBe("Copied");
  });
});
