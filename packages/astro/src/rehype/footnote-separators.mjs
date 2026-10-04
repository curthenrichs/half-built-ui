// Rehype plugin: a superscript comma between back-to-back footnote
// references. remark-gfm emits each [^n] as its own <sup><a
// data-footnote-ref>, so "[^30][^31][^32]" renders as "303132". Only
// references with nothing between them (or only whitespace) get the
// comma; references separated by prose are left alone, which is why
// this lives in the markup and not in a CSS sibling selector (sibling
// combinators skip text nodes). The comma is aria-hidden: each
// reference is already its own link to assistive tech.

/** A <sup> wrapping a remark-gfm footnote reference link. */
function isFootnoteRef(node) {
  if (node?.type !== "element" || node.tagName !== "sup") return false;

  return node.children.some(
    (child) =>
      child.type === "element" &&
      child.tagName === "a" &&
      child.properties?.dataFootnoteRef !== undefined,
  );
}

function isBlankText(node) {
  return node?.type === "text" && node.value.trim() === "";
}

function separator() {
  return {
    type: "element",
    tagName: "sup",
    properties: { ariaHidden: "true" },
    children: [{ type: "text", value: "," }],
  };
}

function walk(node) {
  if (!node.children) return;

  const out = [];
  let lastRef = -1;

  for (const child of node.children) {
    if (isFootnoteRef(child)) {
      if (lastRef !== -1) {
        // Drop whitespace between the two references, then separate.
        out.length = lastRef + 1;
        out.push(separator());
      }

      out.push(child);
      lastRef = out.length - 1;
      continue;
    }

    if (!isBlankText(child)) lastRef = -1;
    out.push(child);
    walk(child);
  }

  node.children = out;
}

export default function rehypeFootnoteSeparators() {
  return (tree) => walk(tree);
}
