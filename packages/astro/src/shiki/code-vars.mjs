// Shiki transformer: rewrite the code theme's baked hex values to the
// css package's custom properties, so highlighted code follows a live
// palette override (spec 2026-09-06, live code colors). Shiki inlines
// literal colors on every span at build; with this transformer the
// build emits var() instead, and the variables resolve to the exact
// same hexes until something overrides them, so adopting it changes
// no rendered pixel. It also encodes ">" in highlighted text (see
// escapeGt), so Code output passes the tooling html-validate preset.
// Pass it wherever shiki options go: the transformers
// prop of astro:components' Code, or markdown.shikiConfig.transformers
// in a consumer's astro config.
const HEX_TO_VAR = {
  "#ffaa3c": "var(--code-token-keyword)",
  "#ffd18a": "var(--code-token-function)",
  "#e07c14": "var(--code-token-string)",
  "#8e7e67": "var(--code-token-comment)",
  "#e8d9c3": "var(--code-fg)",
  "#1b140c": "var(--code-bg)",
};

// Tags (quoted attribute values kept whole) or runs of text. Shiki's
// serializer writes "<" in text as "&#x3C;", so any "<" left in the
// html opens a tag.
const TOKEN = /<(?:[^>"']|"[^"]*"|'[^']*')*>|[^<]+/g;

// Encode ">" in text. codeToHtml (the path astro:components' Code
// takes) serializes with hast-util-to-html, which escapes only "<" and
// "&" in text, so a highlighted ">" reaches the page raw and fails
// html-validate's no-raw-characters in the tooling preset. Markdown
// code never hits this: it goes through codeToHast, and Astro escapes
// the text itself.
function escapeGt(html) {
  return html.replace(TOKEN, (token) =>
    token.startsWith("<") ? token : token.replaceAll(">", "&gt;"),
  );
}

function swap(node) {
  const style = node.properties?.style;
  if (typeof style !== "string") return;

  node.properties.style = style.replace(
    /#[0-9a-fA-F]{6}/g,
    (hex) => HEX_TO_VAR[hex.toLowerCase()] ?? hex,
  );
}

export default {
  name: "half-built-code-vars",
  pre(node) {
    swap(node);
  },
  span(node) {
    swap(node);
  },
  postprocess(html) {
    return escapeGt(html);
  },
};
