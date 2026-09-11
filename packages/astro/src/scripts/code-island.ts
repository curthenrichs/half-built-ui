import { claim, release, type Island, type IslandHandle } from "./core/island";
import { docOf } from "./core/dom";

/* Code island decorator: builds the header bar (filename/language label +
   copy button) above every fenced block in article content. Runs client-side
   from Base.astro; extracted to a module so the DOM behavior is testable
   under jsdom (a phase-1 carry-over closed 2026-07-28). */
/* Island contract (step 9): mount(root, options?) returns a destroy handle;
   claim() makes a second mount over the same pre a no-op. */
export interface CodeIslandOptions {
  selector?: string;
  copy?: { copy: string; copied: string; failed: string };
  resetMs?: number;
}

export const mountCodeIslands: Island<CodeIslandOptions> = (
  root,
  options = {},
): IslandHandle => {
  const {
    selector = ".prose pre.astro-code",
    copy = { copy: "COPY", copied: "COPIED", failed: "FAILED" },
    resetMs = 1500,
  } = options;

  const doc = docOf(root);

  /* resetTimer holds the copy-reset setTimeout id, one live per button at
     most (a second click before the first reset overwrites it, dropping
     the earlier timer's reference so it can no longer be cleared, which
     is why doCopy clears the box before replacing it). A plain mutable
     box, not a field on the mounted entry, so both doCopy and destroy()
     close over the same cell. */
  const mounted: {
    pre: Element;
    bar: HTMLDivElement;
    btn: HTMLButtonElement;
    onClick: () => void;
    resetTimer: { id: ReturnType<typeof setTimeout> | undefined };
  }[] = [];

  for (const pre of root.querySelectorAll(selector)) {
    if (!claim(pre, "code")) continue;
    const bar = doc.createElement("div");
    bar.className = "code-island-bar";
    const label = doc.createElement("span");

    const file = pre
      .closest("[data-code-filename]")
      ?.getAttribute("data-code-filename");

    const lang = pre.getAttribute("data-language") ?? "";
    label.textContent = [file, lang].filter(Boolean).join(" · ");
    const btn = doc.createElement("button");
    btn.className = "code-copy";
    btn.type = "button";
    btn.textContent = copy.copy;

    const resetTimer: { id: ReturnType<typeof setTimeout> | undefined } = {
      id: undefined,
    };

    const doCopy = async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(pre.textContent);
        btn.textContent = copy.copied;
      } catch {
        btn.textContent = copy.failed;
      }

      clearTimeout(resetTimer.id);

      resetTimer.id = setTimeout(() => {
        btn.textContent = copy.copy;
      }, resetMs);
    };

    const onClick = (): void => {
      void doCopy();
    };

    btn.addEventListener("click", onClick);
    bar.append(label, btn);
    pre.before(bar);
    mounted.push({ pre, bar, btn, onClick, resetTimer });
  }

  return {
    destroy(): void {
      for (const { pre, bar, btn, onClick, resetTimer } of mounted) {
        btn.removeEventListener("click", onClick);
        clearTimeout(resetTimer.id);
        bar.remove();
        release(pre, "code");
      }
    },
  };
};
