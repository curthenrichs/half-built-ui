/* Small DOM builders shared by the islands (step 9): el() came from the
   search page's inline script, iconButton() from lightbox.ts. One home,
   per the review's Islands findings; the deliberately-not-included
   focus trap stays not included (native <dialog> owns that). */
export function el<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function iconButton(doc: Document, className: string, label: string, svg: string): HTMLButtonElement {
  const btn = doc.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.setAttribute("aria-label", label);
  btn.innerHTML = svg;
  return btn;
}

/* Every island's root.ownerDocument ?? (root as Document) fallback, in one
   place (step 11.2 docOf sweep): a root that is itself a Document (no
   ownerDocument) resolves to itself. */
export function docOf(root: ParentNode): Document {
  return root.ownerDocument ?? (root as Document);
}
