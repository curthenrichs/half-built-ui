// Shiki transformer: rewrite the code theme's baked hex values to the
// css package's custom properties, so highlighted code follows a live
// palette override (spec 2026-09-06, live code colors). Shiki inlines
// literal colors on every span at build; with this transformer the
// build emits var() instead, and the variables resolve to the exact
// same hexes until something overrides them, so adopting it changes
// no rendered pixel. Pass it wherever shiki options go: the transformers
// prop of astro:components' Code, or markdown.shikiConfig.transformers
// in a consumer's astro config.
const HEX_TO_VAR = {
  "#ffaa3c": "var(--code-token-keyword)",
  "#ffd18a": "var(--code-token-function)",
  "#e07c14": "var(--code-token-string)",
  "#8a7a63": "var(--code-token-comment)",
  "#e8d9c3": "var(--code-fg)",
  "#1b140c": "var(--code-bg)",
};

function swap(node) {
  const style = node.properties?.style;
  if (typeof style !== "string") return;
  node.properties.style = style.replace(/#[0-9a-fA-F]{6}/g, (hex) => HEX_TO_VAR[hex.toLowerCase()] ?? hex);
}

export default {
  name: "half-built-code-vars",
  pre(node) {
    swap(node);
  },
  span(node) {
    swap(node);
  },
};
