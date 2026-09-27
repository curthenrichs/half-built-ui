// @vitest-environment jsdom
/* The day/night toggle island: stamps data-theme on <html>, remembers
   the choice, and keeps the button's state current. The storage key is
   a mount option now (step 11.2), not a package literal; these tests
   supply their own key rather than the blog's, except where they are
   deliberately checking the no-key degradation. */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  readStored,
  apply,
  mountThemeToggle,
} from "../src/scripts/theme-toggle";

const KEY = "test-theme-key";

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: (k: string) => {
      m.delete(k);
    },
    clear: () => {
      m.clear();
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
  document.body.innerHTML = `<button type="button" class="theme-toggle" aria-label="Switch to dark mode"></button>`;
  localStorage.clear();
});

describe("theme toggle", () => {
  it("readStored accepts only light or dark, and no-ops without a key", () => {
    expect(readStored(fakeStorage({ [KEY]: "dark" }), KEY)).toBe("dark");
    expect(readStored(fakeStorage({ [KEY]: "sepia" }), KEY)).toBeNull();
    expect(readStored(null, KEY)).toBeNull();
    expect(readStored(fakeStorage({ [KEY]: "dark" }))).toBeNull();
  });

  it("apply stamps dark and clears light", () => {
    apply(document, "dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    apply(document, "light");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("click toggles the theme, stores it under the given key, and updates the button", () => {
    const storage = fakeStorage();
    mountThemeToggle(document, { storage, storageKey: KEY });
    const btn = document.querySelector<HTMLButtonElement>(".theme-toggle");
    if (!btn) throw new Error("no button");
    btn.click();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(storage.getItem(KEY)).toBe("dark");
    expect(btn.getAttribute("aria-label")).toBe("Switch to light mode");
    btn.click();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(storage.getItem(KEY)).toBe("light");
    expect(btn.getAttribute("aria-label")).toBe("Switch to dark mode");
  });

  it("carries an action label and no aria-pressed, in both themes", () => {
    mountThemeToggle(document, { storage: fakeStorage(), storageKey: KEY });
    const btn = document.querySelector<HTMLButtonElement>(".theme-toggle");
    expect(btn?.hasAttribute("aria-pressed")).toBe(false);
    btn?.click();
    expect(btn?.hasAttribute("aria-pressed")).toBe(false);
    expect(btn?.getAttribute("aria-label")).toMatch(/Switch to/);
  });

  it("claims each button, and one mount's click keeps another mount's labels", () => {
    document.body.innerHTML = `
      <div id="root-a"><button type="button" class="theme-toggle" id="a"></button></div>
      <div id="root-b"><button type="button" class="theme-toggle" id="b"></button></div>`;

    const rootA = document.getElementById("root-a");
    const rootB = document.getElementById("root-b");
    if (!rootA || !rootB) throw new Error("fixture missing roots");

    mountThemeToggle(rootA, {
      storage: fakeStorage(),
      storageKey: KEY,
      labels: { light: "LA", dark: "DA" },
    });

    mountThemeToggle(rootB, {
      storage: fakeStorage(),
      storageKey: KEY,
      labels: { light: "LB", dark: "DB" },
    });

    const a = document.getElementById("a") as HTMLButtonElement | null;
    const b = document.getElementById("b") as HTMLButtonElement | null;
    if (!a || !b) throw new Error("fixture missing buttons");

    expect(a.hasAttribute("data-island-theme-toggle")).toBe(true);

    a.click();

    const theme =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";

    expect(a.getAttribute("aria-label")).toBe(theme === "dark" ? "DA" : "LA");
    expect(b.getAttribute("aria-label")).toBe(theme === "dark" ? "DB" : "LB");
  });

  it("mount reflects a theme the head stamp already applied", () => {
    document.documentElement.dataset.theme = "dark";

    mountThemeToggle(document, {
      storage: fakeStorage({ [KEY]: "dark" }),
      storageKey: KEY,
    });

    const btn = document.querySelector<HTMLButtonElement>(".theme-toggle");
    expect(btn?.getAttribute("aria-label")).toBe("Switch to light mode");
  });

  it("destroy stops the button", () => {
    const h = mountThemeToggle(document, {
      storage: fakeStorage(),
      storageKey: KEY,
    });

    h.destroy();
    document.querySelector<HTMLButtonElement>(".theme-toggle")?.click();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("two placements stay in step", () => {
    document.body.innerHTML = `
      <button type="button" class="theme-toggle" aria-label="Switch to dark mode"></button>
      <button type="button" class="theme-toggle theme-toggle-phone" aria-label="Switch to dark mode"></button>`;

    mountThemeToggle(document, { storage: fakeStorage(), storageKey: KEY });

    const [band, phone] = [
      ...document.querySelectorAll<HTMLButtonElement>(".theme-toggle"),
    ];

    phone.click();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(band.getAttribute("aria-label")).toBe("Switch to light mode");
    band.click();
    expect(phone.getAttribute("aria-label")).toBe("Switch to dark mode");
  });

  it("mounting twice binds once", () => {
    const storage = fakeStorage();
    mountThemeToggle(document, { storage, storageKey: KEY });
    mountThemeToggle(document, { storage, storageKey: KEY });
    document.querySelector<HTMLButtonElement>(".theme-toggle")?.click();
    expect(document.documentElement.dataset.theme).toBe("dark");
    vi.restoreAllMocks();
  });

  it("mounts with an explicit storageKey and persists a click under it", () => {
    mountThemeToggle(document, { storageKey: "custom-key" });
    const btn = document.querySelector<HTMLButtonElement>(".theme-toggle");
    if (!btn) throw new Error("no button");
    btn.click();
    expect(localStorage.getItem("custom-key")).toBe("dark");
  });

  it("mounts with no storageKey and still flips the theme, but persists nothing", () => {
    const before = localStorage.length;
    mountThemeToggle(document);
    const btn = document.querySelector<HTMLButtonElement>(".theme-toggle");
    if (!btn) throw new Error("no button");
    btn.click();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.length).toBe(before);
  });
});
