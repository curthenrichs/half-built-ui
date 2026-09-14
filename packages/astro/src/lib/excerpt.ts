/* Card text derived from a post body (owner call 2026-09-13; the rule
   is recorded in the blog's docs/superpowers/specs/2026-09-13-derived-excerpts-design.md
   and summarized in this package's README, "Derived excerpts"). The
   card is the opening prose, consecutive paragraphs joined, cut at a
   word boundary within EXCERPT_LIMIT and always ended with an
   ellipsis, so every listing samples the post's own opening and the
   reader can see it continues. Consumers keep no excerpt frontmatter.

   Built site-side in the blog first and proved on its 54 posts, then
   moved here on 2026-09-14 (owner call) so BEADZ and later sites get
   the same rule. The blog is the reference consumer. */

export const EXCERPT_LIMIT = 200;

const MARKER = /^\s*<ExcerptStart\s*\/>\s*$/m;

/* Block-level things that are not prose, removed before the body is
   split into paragraphs. Order matters only for the code fence, which
   must go before anything that would look inside it. */
const IMPORT_LINE = /^import .*$/gm;
const CODE_FENCE = /```[\s\S]*?```/g;
const LEAD_BREAK = /<div class="lead-break">[\s\S]*?<\/div>/g;

/* A capitalized tag is a component. It is a block only when it
   occupies whole lines: opening tag starts a line, closing tag ends
   one. Non-greedy to the same close tag; the posts do not nest a
   component inside itself. A component inline in a sentence (PostLink,
   WhenPublished around a link) is not matched here and keeps its text
   through flatten; the built-output suite caught the Robot Migrates
   card as the word "In" on 2026-09-13 when this was not so. */
const COMPONENT_BLOCK =
  /^[ \t]*<([A-Z][A-Za-z0-9]*)\b[^>]*>[\s\S]*?<\/\1>[ \t]*$/gm;

const SELF_CLOSING = /^[ \t]*<[A-Za-z][A-Za-z0-9-]*\b[^>]*\/>[ \t]*$/gm;
/* A lowercase tag opening a line is an html block (figure, div,
   details); it runs to its close. */
const HTML_BLOCK = /^<([a-z][a-z0-9-]*)\b[^>]*>[\s\S]*?<\/\1>/gm;
const MDX_EXPRESSION_LINE = /^\s*\{[\s\S]*?\}\s*$/gm;

/* Paragraph test: the first non-space character says what the block
   is. A block that starts with a tag is not rejected here; after the
   block-level removals above, a leading tag is an inline component or
   element opening a sentence, and flatten keeps its text. A bare
   triple backtick is the sentinel a code fence leaves behind. */
const NOT_PROSE = /^(?:#|>|-\s|\*\s|\||!|```|\d+[.)]\s)/;

/* A code fence is emptied rather than removed: the sentinel keeps it
   a non-prose block, so it still ends the opening prose (spec rule 1)
   instead of vanishing and letting the run continue past it. */
function stripBlocks(body: string): string {
  return body
    .replace(CODE_FENCE, "\n\n```\n\n")
    .replace(IMPORT_LINE, "")
    .replace(LEAD_BREAK, "\n\n")
    .replace(COMPONENT_BLOCK, "\n\n")
    .replace(HTML_BLOCK, "\n\n")
    .replace(SELF_CLOSING, "\n\n")
    .replace(MDX_EXPRESSION_LINE, "\n\n");
}

/* The opening prose: consecutive prose blocks from the top, joined by
   a space, until the limit is reached (owner call 2026-09-13, after
   RoverBot's one-line opener made a one-line card; the same afternoon
   the card had been the first paragraph alone). Non-prose blocks
   before any prose are skipped, as before; the first non-prose block
   after prose has started (a heading, a list, a quote, a code fence,
   an image line) ends the run, so a card never crosses into a later
   section. Components and the lead-break were stripped above, so a
   gallery between two intro paragraphs does not end it. A block made
   only of tags (a stray inline component on its own line) flattens to
   nothing and is passed over. */
function openingProse(body: string): string | null {
  const blocks = stripBlocks(body)
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  let taken = "";

  for (const b of blocks) {
    if (NOT_PROSE.test(b)) {
      if (taken) break;
      continue;
    }

    const text = flatten(b);
    if (!text) continue;
    taken = taken ? `${taken} ${text}` : text;
    if (taken.length >= EXCERPT_LIMIT) break;
  }

  return taken || null;
}

/* Inline markdown to plain text. Links keep their text (inline and
   reference style), mdx comments and expressions go, emphasis and code
   markers go, inline html tags go and their text stays, escapes lose
   the backslash, and the block's own line breaks collapse to one
   space. */
function flatten(block: string): string {
  return block
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\{[^{}\n]*\}/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^\w\\])[*_](.+?)[*_](?=[^\w]|$)/g, "$1$2")
    .replace(/\\([*_`[\]\\])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/* The cut (owner call 2026-09-13, replacing the sentence rule the same
   day): whole words while the text stays within the limit, then the
   ellipsis, always. The ellipsis is the reader's cue that the post
   continues, so it goes on even when the whole paragraph fits. A
   period, comma, colon, or semicolon right before it comes off, so the
   card ends "onto Cloudflare Pages…" and not "Pages.…"; a question
   mark or exclamation stays. */
function cutAtWords(text: string): string {
  let out = text;

  if (out.length > EXCERPT_LIMIT) {
    /* One past the limit so a word that ends exactly there survives:
       the space after it is what the search finds. */
    const head = out.slice(0, EXCERPT_LIMIT + 1);
    const lastSpace = head.lastIndexOf(" ");

    out =
      lastSpace > 0 ? head.slice(0, lastSpace) : out.slice(0, EXCERPT_LIMIT);
  }

  return `${out.replace(/[.,;:]+$/, "").trimEnd()}…`;
}

export function deriveExcerpt(body: string): string | null {
  const marker = MARKER.exec(body);
  const source = marker ? body.slice(marker.index + marker[0].length) : body;
  const text = openingProse(source);
  return text === null ? null : cutAtWords(text);
}

/* Each warning prints once per build. postExcerpt runs once per page
   that lists a post (home, archives, categories, feed, search index),
   so without this a drafts build repeated seven stub warnings fifty
   times and buried anything else in the log (2026-09-13). */
const warned = new Set<string>();

function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

/* Test hook: the set outlives a test, so a suite that asserts a
   warning clears it between cases. */
export function resetExcerptWarnings(): void {
  warned.clear();
}

/* The consumer's collection entry, structurally: body is the raw MDX
   minus frontmatter as Astro's content layer hands it over, slug names
   the post in a thrown error or a warning, and draft selects the
   policy. A CollectionEntry<"posts"> satisfies this with no cast; the
   same shape lib/drafts.ts uses for Draftable. */
export interface Excerptable {
  body?: string;
  data: { slug: string; draft?: boolean };
}

/* The one place the publish policy lives (spec, "Consumers"): every
   consumer calls this, never deriveExcerpt directly. A published post
   with no usable opening fails the build; a draft with none warns and
   renders blank, so a SHOW_DRAFTS=1 build still runs and the stub is
   loud without being a wall. */
export function postExcerpt(post: Excerptable): string {
  const slug = post.data.slug;
  const derived = deriveExcerpt(post.body ?? "");

  if (derived === null) {
    if (post.data.draft) {
      warnOnce(
        `[excerpt] draft "${slug}" has no prose paragraph; card is blank`,
      );

      return "";
    }

    throw new Error(
      `[excerpt] published post "${slug}" has no prose paragraph to derive a card from`,
    );
  }

  return derived;
}
