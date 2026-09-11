// @vitest-environment jsdom
/* DOM runtime test for the code island decorator (the phase-1 carry-over).
   Everything else in the suite asserts built HTML; this exercises the
   client-side behavior the build output cannot show: bar insertion, label
   composition, and the copy button's state machine. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mountCodeIslands } from "../src/scripts/code-island";

const PAGE = `
  <main class="prose">
    <div data-code-filename="demo.py"><pre class="astro-code" data-language="python"><code>print("hi")</code></pre></div>
    <pre id="plain" class="astro-code" data-language="basic"><code>PAUSE 20</code></pre>
  </main>
  <pre id="outside" class="astro-code" data-language="js"><code>nope</code></pre>`;

function clickCopy(index: number): HTMLButtonElement {
  const btn = document.querySelectorAll<HTMLButtonElement>(".code-copy")[index];
  btn.click();
  return btn;
}

/* The click handler is async (one await on the clipboard promise); a few
   microtask turns settle it without touching the fake timer clock. */
async function settle(): Promise<void> {
  for (let i = 0; i < 4; i++) await Promise.resolve();
}

describe("code island decorator (DOM runtime)", () => {
  beforeEach(() => {
    document.body.innerHTML = PAGE;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("decorates blocks inside prose and leaves others alone", () => {
    mountCodeIslands(document);
    expect(document.querySelectorAll(".code-island-bar").length).toBe(2);
    const before = document.getElementById("outside")?.previousElementSibling;
    expect(before?.classList.contains("code-island-bar")).toBe(false);
  });

  it("labels carry filename and language when present, language alone otherwise", () => {
    mountCodeIslands(document);

    const labels = [...document.querySelectorAll(".code-island-bar span")].map(
      (s) => s.textContent,
    );

    expect(labels[0]).toBe("demo.py · python");
    expect(labels[1]).toBe("basic");
  });

  it("copy button writes the block text and shows COPIED, then resets", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    mountCodeIslands(document);
    const btn = clickCopy(1);
    await settle();
    expect(btn.textContent).toBe("COPIED");
    expect(writeText).toHaveBeenCalledWith("PAUSE 20");
    vi.advanceTimersByTime(1500);
    expect(btn.textContent).toBe("COPY");
  });

  it("copy button shows FAILED when the clipboard rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    mountCodeIslands(document);
    const btn = clickCopy(0);
    await settle();
    expect(btn.textContent).toBe("FAILED");
  });

  it("mounting twice decorates each pre once (claim guards the second pass)", () => {
    mountCodeIslands(document);
    mountCodeIslands(document);
    expect(document.querySelectorAll(".code-island-bar").length).toBe(2);

    for (const pre of document.querySelectorAll(".prose pre.astro-code")) {
      expect(pre.hasAttribute("data-island-code")).toBe(true);
    }
  });

  it("destroy removes the bars and the claim", () => {
    const handle = mountCodeIslands(document);
    expect(document.querySelectorAll(".code-island-bar").length).toBe(2);
    handle.destroy();
    expect(document.querySelectorAll(".code-island-bar").length).toBe(0);

    for (const pre of document.querySelectorAll(".prose pre.astro-code")) {
      expect(pre.hasAttribute("data-island-code")).toBe(false);
    }
  });

  it("custom copy labels appear on the button through a click cycle", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    mountCodeIslands(document, {
      copy: { copy: "GET", copied: "GOT IT", failed: "NOPE" },
    });

    const btn = document.querySelectorAll<HTMLButtonElement>(".code-copy")[0];
    expect(btn.textContent).toBe("GET");
    btn.click();
    await settle();
    expect(btn.textContent).toBe("GOT IT");
    vi.advanceTimersByTime(1500);
    expect(btn.textContent).toBe("GET");
  });
});
