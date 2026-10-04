/* rehype/footnote-separators through Astro's own markdown processor,
   the path a consumer's markdown.rehypePlugins takes: back-to-back
   footnote references get a superscript comma, references split by
   prose do not. */
import { describe, it, expect } from "vitest";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import footnoteSeparators from "../src/rehype/footnote-separators.mjs";

const NOTES = "\n\n[^1]: One.\n[^2]: Two.\n[^3]: Three.\n";

async function render(body: string): Promise<string> {
  const processor = await createMarkdownProcessor({
    syntaxHighlight: false,
    rehypePlugins: [footnoteSeparators],
  });

  return (await processor.render(body + NOTES)).code;
}

const SEP = '<sup aria-hidden="true">,</sup>';

/* The sentence's own paragraph, without the footnotes section. */
function lead(html: string): string {
  return html.split("<section")[0];
}

describe("rehype/footnote-separators", () => {
  it("puts a comma between adjacent references", async () => {
    const html = lead(await render("Claim.[^1][^2][^3]"));

    expect(html.split(SEP)).toHaveLength(3);

    expect(html).toMatch(
      /fnref-1.*<\/sup><sup aria-hidden="true">,<\/sup><sup>.*fnref-2/,
    );
  });

  it("treats whitespace between references as adjacent", async () => {
    const html = lead(await render("Claim.[^1] [^2]"));

    expect(html.split(SEP)).toHaveLength(2);
    expect(html).not.toMatch(/<\/sup>\s+<sup/);
  });

  it("leaves references separated by prose alone", async () => {
    const html = lead(
      await render("One claim[^1] and another.[^2] Third.[^3]"),
    );

    expect(html).not.toContain(SEP);
  });

  it("leaves a lone reference and plain superscripts alone", async () => {
    const html = lead(
      await render("Claim.[^1] E = mc<sup>2</sup><sup>3</sup>"),
    );

    expect(html).not.toContain(SEP);
  });
});
