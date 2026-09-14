/* deriveExcerpt and postExcerpt (README, "Derived excerpts"): the
   card is the opening prose of a post body, consecutive paragraphs
   joined, cut at a word boundary within EXCERPT_LIMIT and always
   ended with an ellipsis, the reader's cue that the post continues.
   Proved on the blog's 54 posts on 2026-09-13, moved here 2026-09-14
   (owner call). String fixtures only; no build. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  deriveExcerpt,
  postExcerpt,
  resetExcerptWarnings,
  EXCERPT_LIMIT,
  type Excerptable,
} from "../src/lib/excerpt";

const LEAD_BREAK = '<div class="lead-break">\n---\n</div>';

describe("deriveExcerpt: finding the paragraph", () => {
  it("skips import lines and the lead-break", () => {
    const body = `import Gallery from "@half-built/astro/content/Gallery.astro";\nimport __img0 from "../../assets/x.jpg";\n\n${LEAD_BREAK}\n\nFirst real sentence. Second one.\n\nNext paragraph.`;

    expect(deriveExcerpt(body)).toBe(
      "First real sentence. Second one. Next paragraph…",
    );
  });

  it("skips a multi-line component block, a self-closing tag, and an EditorNote", () => {
    const body = `${LEAD_BREAK}\n\n<Gallery>\n  <GalleryImage src={__img0} alt="A thing." />\n  <Fragment slot="caption">A caption sentence.</Fragment>\n</Gallery>\n\n<Spacer size={40} />\n\n<EditorNote title="Photos">Your husband's photos, if they turn up.</EditorNote>\n\nThe prose starts here.`;
    expect(deriveExcerpt(body)).toBe("The prose starts here…");
  });

  it("skips a heading, a code fence, a blockquote, and lists", () => {
    const body = `## Setup\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n> Quoted line.\n\n- one\n- two\n\n1. first\n2. second\n\n* starred\n\nProse at last.`;
    expect(deriveExcerpt(body)).toBe("Prose at last…");
  });

  it("skips a lowercase html block and an image line", () => {
    const body = `<figure>\n  <img src="x.png" alt="x" />\n</figure>\n\n![alt text](x.png)\n\nProse.`;
    expect(deriveExcerpt(body)).toBe("Prose…");
  });

  it("takes an italic line as a paragraph", () => {
    const body = `${LEAD_BREAK}\n\n_TL;DR: I skinned a dog toy._\n\nThe long version.`;

    expect(deriveExcerpt(body)).toBe(
      "TL;DR: I skinned a dog toy. The long version…",
    );
  });

  it("returns null for a body with no prose", () => {
    const body = `import EditorNote from "../../components/content/EditorNote.astro";\n\n<EditorNote title="Write me">Curt writes this one.</EditorNote>\n\n<Gallery>\n  <GalleryImage src={__img0} alt="x" />\n</Gallery>`;
    expect(deriveExcerpt(body)).toBeNull();
  });

  it("returns null for an empty body", () => {
    expect(deriveExcerpt("")).toBeNull();
  });
});

describe("deriveExcerpt: the marker", () => {
  it("starts at the paragraph after <ExcerptStart />, even when a valid paragraph precedes it", () => {
    const body = `_TL;DR: the short version._\n\n<ExcerptStart />\n\nThe real opening. It continues.`;
    expect(deriveExcerpt(body)).toBe("The real opening. It continues…");
  });

  it("tolerates whitespace around the marker and uses the first of two", () => {
    /* The second marker is invisible: it strips as a whole-line tag,
       so the prose after it merges like any next paragraph. */
    const body = `Aside.\n\n  <ExcerptStart />  \n\nChosen one.\n\n<ExcerptStart />\n\nNot this.`;
    expect(deriveExcerpt(body)).toBe("Chosen one. Not this…");
  });

  it("returns null when nothing follows the marker", () => {
    const body = `Aside.\n\n<ExcerptStart />\n\n<Spacer size={20} />`;
    expect(deriveExcerpt(body)).toBeNull();
  });
});

describe("deriveExcerpt: the opening prose runs across paragraphs", () => {
  /* Owner call 2026-09-13 (RoverBot's one-line opener made a one-line
     card): the card is as much of the opening prose as fits, not the
     first paragraph alone. It stops at the first block that is not
     prose so it never runs into a later section. */
  it("merges consecutive short paragraphs with a space", () => {
    const body = `Short opener.\n\nSecond paragraph here.\n\nThird one too.`;

    expect(deriveExcerpt(body)).toBe(
      "Short opener. Second paragraph here. Third one too…",
    );
  });

  it("stops at a heading", () => {
    const body = `Opener.\n\n## Hardware\n\nLater prose in another section.`;
    expect(deriveExcerpt(body)).toBe("Opener…");
  });

  it("stops at a list, a blockquote, a code fence, and an image line", () => {
    expect(deriveExcerpt(`Opener.\n\n- item\n\nMore.`)).toBe("Opener…");
    expect(deriveExcerpt(`Opener.\n\n> quoted\n\nMore.`)).toBe("Opener…");

    expect(deriveExcerpt(`Opener.\n\n\`\`\`js\nx()\n\`\`\`\n\nMore.`)).toBe(
      "Opener…",
    );

    expect(deriveExcerpt(`Opener.\n\n![alt](x.png)\n\nMore.`)).toBe("Opener…");
  });

  it("runs through a component block between two intro paragraphs", () => {
    const body = `Opener.\n\n<Gallery>\n  <GalleryImage src={__img0} alt="x" />\n</Gallery>\n\nSecond.`;
    expect(deriveExcerpt(body)).toBe("Opener. Second…");
  });

  it("still skips non-prose blocks that come before any prose", () => {
    const body = `## Title\n\n- a list first\n\nThen prose.\n\nAnd more.`;
    expect(deriveExcerpt(body)).toBe("Then prose. And more…");
  });

  it("cuts at a word across the paragraph boundary when the limit lands there", () => {
    const first =
      Array.from({ length: 25 }, (_, i) => `alpha${i}`).join(" ") + ".";

    const second =
      Array.from({ length: 25 }, (_, i) => `beta${i}`).join(" ") + ".";

    const out = deriveExcerpt(`${first}\n\n${second}`) ?? "";
    expect(out.startsWith(first)).toBe(true);
    expect(/beta\d+…$/.test(out)).toBe(true);
    expect(out.length).toBeLessThanOrEqual(EXCERPT_LIMIT + 1);
  });
});

describe("deriveExcerpt: the cut", () => {
  it("always ends with the ellipsis, even when the whole paragraph fits", () => {
    expect(deriveExcerpt("Short one.")).toBe("Short one…");
  });

  it("drops a trailing period, comma, colon, or semicolon before the ellipsis", () => {
    expect(deriveExcerpt("Ends with a colon:")).toBe("Ends with a colon…");
    expect(deriveExcerpt("Ends with a comma,")).toBe("Ends with a comma…");

    expect(deriveExcerpt("Ends with a semicolon;")).toBe(
      "Ends with a semicolon…",
    );
  });

  it("keeps a question mark or exclamation before the ellipsis", () => {
    expect(deriveExcerpt("Really?")).toBe("Really?…");
    expect(deriveExcerpt("Wow!")).toBe("Wow!…");
  });

  it("keeps whole words within the limit and never a space before the ellipsis", () => {
    const words =
      Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ") + ".";

    const out = deriveExcerpt(words) ?? "";
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(EXCERPT_LIMIT + 1);
    expect(out).not.toMatch(/\s…$/);
    /* the cut lands after a whole word: the ellipsis follows a full "wordNN" */
    expect(/word\d+…$/.test(out)).toBe(true);
  });

  it("a paragraph of exactly the limit stays whole", () => {
    const exact = "a".repeat(99) + " " + "b".repeat(100);
    expect(exact.length).toBe(EXCERPT_LIMIT);
    expect(deriveExcerpt(exact)).toBe(`${exact}…`);
  });

  it("a word that ends exactly at the limit survives the cut", () => {
    const text = "a".repeat(99) + " " + "b".repeat(100) + " more words after";
    expect(deriveExcerpt(text)).toBe(`${"a".repeat(99)} ${"b".repeat(100)}…`);
  });

  it("a single word longer than the limit is cut hard at the limit", () => {
    const giant = "x".repeat(250);
    const out = deriveExcerpt(giant) ?? "";
    expect(out).toBe(`${"x".repeat(EXCERPT_LIMIT)}…`);
  });
});

describe("deriveExcerpt: flattening", () => {
  it("keeps link text, strips emphasis and inline code markers, keeps inline html text, collapses whitespace", () => {
    const body = `I read [the paper](https://example.com/p) twice,\n*really* did, and ran \`npm test\` on the <abbr title="single board computer">SBC</abbr>.`;

    expect(deriveExcerpt(body)).toBe(
      "I read the paper twice, really did, and ran npm test on the SBC…",
    );
  });

  it("drops escaping backslashes and handles bold and underscore emphasis", () => {
    const body = `A \\*literal\\* star, **bold** words, and __more__ of them.`;

    expect(deriveExcerpt(body)).toBe(
      "A *literal* star, bold words, and more of them…",
    );
  });
});

describe("deriveExcerpt: inline components inside prose", () => {
  /* Found by the built-output suite on 2026-09-13: the Robot Migrates
     card came out as the single word "In" because the opening sentence
     links the cutover post with an inline PostLink and the block
     stripper cut it out of the paragraph. Only a component that
     occupies whole lines is a block; inline ones keep their text. */
  it("keeps an inline PostLink's text inside the opening sentence", () => {
    const body = `In <PostLink slug="cutover">the cutover post</PostLink> I said what changed. This one is how.`;

    expect(deriveExcerpt(body)).toBe(
      "In the cutover post I said what changed. This one is how…",
    );
  });

  it("keeps a WhenPublished-wrapped inline link's text", () => {
    const body = `It hosts my <WhenPublished slug="bot"><PostLink slug="bot">trading bot pipeline</PostLink></WhenPublished>. Done.`;
    expect(deriveExcerpt(body)).toBe("It hosts my trading bot pipeline. Done…");
  });

  it("a paragraph that opens with an inline component is still prose", () => {
    const body = `<PostLink slug="p1">Part 1</PostLink> covered the build. This is part 2.`;

    expect(deriveExcerpt(body)).toBe(
      "Part 1 covered the build. This is part 2…",
    );
  });

  it("a component that occupies whole lines is still skipped as a block", () => {
    const body = `<WhenPublished slug="later">\n\nA paragraph that only renders once the later post ships.\n\n</WhenPublished>\n\nThe opening for everyone.`;
    expect(deriveExcerpt(body)).toBe("The opening for everyone…");
  });

  it("drops an inline mdx comment and a stray expression from the text", () => {
    const body = `Real words {/* note to self */} and more{" "}words.`;
    expect(deriveExcerpt(body)).toBe("Real words and more words…");
  });
});

function mkEntry(body: string, draft = false): Excerptable {
  return { body, data: { slug: "fixture-post", draft } };
}

describe("postExcerpt: the publish policy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetExcerptWarnings();
  });

  it("prints a given warning once per build, however many pages list the post", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const stub = mkEntry("<Spacer size={20} />", true);
    postExcerpt(stub);
    postExcerpt(stub);
    postExcerpt(stub);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("returns the derived text for a post with prose", () => {
    expect(postExcerpt(mkEntry("A fine opening. Then more."))).toBe(
      "A fine opening. Then more…",
    );
  });

  it("throws for a published post with no prose, naming the slug", () => {
    expect(() => postExcerpt(mkEntry("<Spacer size={20} />"))).toThrow(
      /fixture-post/,
    );
  });

  it("returns an empty string and warns for a draft with no prose", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(postExcerpt(mkEntry("<Spacer size={20} />", true))).toBe("");
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain("fixture-post");
  });

  it("does not warn about a long opening; the word cut is the rule, not a fallback", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const long =
      Array.from({ length: 60 }, (_, i) => `word${i}`).join(" ") + ".";

    expect(postExcerpt(mkEntry(long)).endsWith("…")).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it("treats a missing body as no prose", () => {
    expect(() =>
      postExcerpt({ data: { slug: "fixture-post", draft: false } }),
    ).toThrow(/fixture-post/);
  });
});

describe("ExcerptStart marker component", () => {
  it("exists, renders nothing, and says why", () => {
    const src = readFileSync(
      fileURLToPath(
        new URL(
          "../src/components/content/ExcerptStart.astro",
          import.meta.url,
        ),
      ),
      "utf-8",
    );

    /* No markup outside the frontmatter fence and the one template
       comment: the component's whole job is to be found in the source
       by deriveExcerpt. */
    const afterFence = src
      .split("---")
      .slice(2)
      .join("---")
      .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
      .trim();

    expect(afterFence).toBe("");
    expect(src).toContain("Derived excerpts");
  });

  it("a post that imports the marker still derives from the paragraph after it", () => {
    const body = `import ExcerptStart from "../../components/content/ExcerptStart.astro";\n\n_TL;DR: short._\n\n<ExcerptStart />\n\nThe opening proper.`;
    expect(deriveExcerpt(body)).toBe("The opening proper…");
  });
});
