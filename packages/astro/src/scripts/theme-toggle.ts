/* Day/night toggle (owner request 2026-08-25): the header button next to
   the date stamp flips data-theme on <html> between light and dark and
   remembers the choice. The first paint is handled by the inline stamp in
   Shell.astro's head, which reads the same storage key (or, with nothing
   stored, the system preference), so there is no flash of the wrong
   theme; this island only wires the button. Shape follows the library's
   mount(root, options?) contract (step 9): idempotent, and it returns a
   destroy handle. The storage key is a mount option, not a package
   literal (step 11.2); the blog passes it from lib/theme-key. */

import { type Island, type IslandHandle } from "./core/island";
import { docOf } from "./core/dom";

export type Theme = "light" | "dark";

const LABEL: Record<Theme, string> = {
  light: "Switch to dark mode",
  dark: "Switch to light mode",
};

/* Storage can be absent or throwing (private mode, blocked site data);
   every access is guarded and a bad value reads as no choice. With no
   storageKey there is nowhere to read from, so this reads as no choice
   too rather than guessing at a key. */
export function readStored(
  storage: Storage | null,
  storageKey?: string,
): Theme | null {
  if (!storageKey) return null;

  try {
    const v = storage?.getItem(storageKey);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

/* With no storageKey, this no-ops: the toggle still flips the theme for
   the page, it just does not persist the choice. That is a safe
   degradation for an adopter who forgot to pass one, not a broken
   toggle. */
function writeStored(
  storage: Storage | null,
  storageKey: string | undefined,
  theme: Theme,
): void {
  if (!storageKey) return;

  try {
    storage?.setItem(storageKey, theme);
  } catch {
    /* nothing to do: the choice lives for this page only */
  }
}

export function current(doc: Document): Theme {
  return doc.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/* Light is the absence of the attribute, so the light theme stays the
   plain :root definition and the dark file only ever adds. */
export function apply(doc: Document, theme: Theme): void {
  if (theme === "dark") doc.documentElement.dataset.theme = "dark";
  else delete doc.documentElement.dataset.theme;
}

function reflect(
  btn: HTMLButtonElement,
  theme: Theme,
  labels: Record<Theme, string>,
): void {
  btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  btn.setAttribute("aria-label", labels[theme]);
  btn.title = labels[theme];
}

/* Every mounted button, so a click on one (the top band's, or the
   phone placement beside the search) updates the state of all. */
const mounted = new Set<HTMLButtonElement>();

export interface ThemeToggleOptions {
  selector?: string;
  doc?: Document;
  storage?: Storage | null;
  /* No default: the toggle bakes in no brand's key. Pass the site's
     key to persist a choice; omit it and the toggle still works for
     the page, it just forgets on reload. */
  storageKey?: string;
  /* Button aria-label/title text per theme, defaulting to the English
     day/night pair above. */
  labels?: Record<Theme, string>;
}

export const mountThemeToggle: Island<ThemeToggleOptions> = (
  root,
  options = {},
): IslandHandle => {
  const doc = options.doc ?? docOf(root);

  const {
    selector = ".theme-toggle",
    storage = safeStorage(doc),
    storageKey,
    labels = LABEL,
  } = options;

  const handlers: [HTMLButtonElement, () => void][] = [];

  for (const btn of root.querySelectorAll<HTMLButtonElement>(selector)) {
    if (mounted.has(btn)) continue;
    mounted.add(btn);
    reflect(btn, current(doc), labels);

    const onClick = () => {
      const next: Theme = current(doc) === "dark" ? "light" : "dark";
      apply(doc, next);
      writeStored(storage, storageKey, next);
      for (const b of mounted) reflect(b, next, labels);
    };

    btn.addEventListener("click", onClick);
    handlers.push([btn, onClick]);
  }

  return {
    destroy(): void {
      for (const [btn, onClick] of handlers) {
        btn.removeEventListener("click", onClick);
        mounted.delete(btn);
      }
    },
  };
};

function safeStorage(doc: Document): Storage | null {
  try {
    return doc.defaultView?.localStorage ?? null;
  } catch {
    return null;
  }
}
