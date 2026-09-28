/* shiki/code-vars through Shiki's real codeToHtml, the path
   astro:components' Code takes: baked theme hexes become the css
   package's custom properties, and a ">" in highlighted text is
   encoded, so the output passes the tooling html-validate preset's
   no-raw-characters rule (TOOL-8). */
import { describe, it, expect } from "vitest";
import { codeToHtml } from "shiki";
import codeTheme from "../src/shiki/code-theme.mjs";
import codeVars from "../src/shiki/code-vars.mjs";

async function render(code: string, lang = "ts"): Promise<string> {
  return codeToHtml(code, { lang, theme: codeTheme, transformers: [codeVars] });
}

/* The text between tags, with every tag removed. */
function textRuns(html: string): string[] {
  return html.split(/<[^>]*>/).filter((run) => run.length > 0);
}

describe("shiki/code-vars", () => {
  it("swaps the theme's baked hexes for custom properties", async () => {
    const html = await render("const x = 1;");

    expect(html).toContain("var(--code-bg)");
    expect(html).toContain("var(--code-fg)");
    expect(html).not.toMatch(/#1b140c|#e8d9c3/i);
  });

  it("encodes > in highlighted text", async () => {
    const html = await render(
      '<a href="#x">link</a>\nconst f = (a) => a > 1;',
      "tsx",
    );

    for (const run of textRuns(html)) {
      expect(run, `raw ">" in text run ${JSON.stringify(run)}`).not.toContain(
        ">",
      );
    }

    expect(html).toContain("&gt;");
  });

  it("leaves tags and attribute values alone", async () => {
    const html = await render("a > b");

    expect(html).toMatch(/^<pre class="shiki[^"]*"[^>]*>/);
    expect(html).toMatch(/<\/code><\/pre>$/);
    expect(html).toContain('<span class="line">');
  });
});
