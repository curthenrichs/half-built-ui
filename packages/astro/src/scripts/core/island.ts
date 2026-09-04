/* The island contract (step 9, spec sequence item 9): every client
   behavior is mount(root, options?) returning a destroy handle, and
   mounting twice is a no-op per element via claim(). Options carry the
   selectors and copy that used to be baked in, defaulting to this
   site's values, so another consumer overrides without forking. */
export interface IslandHandle {
  destroy(): void;
}

export type Island<O = void> = (root: ParentNode, options?: O) => IslandHandle;

/* One claim per element per island name. A data attribute, not a
   WeakSet: visible in devtools when debugging a double-mount. */
export function claim(target: Element, island: string): boolean {
  const key = `data-island-${island}`;
  if (target.hasAttribute(key)) return false;
  target.setAttribute(key, "");
  return true;
}

/* Mirror of claim(): destroy() paths call this instead of hardcoding
   the attribute name (Task 2 review's latent-coupling finding). */
export function release(target: Element, island: string): void {
  target.removeAttribute(`data-island-${island}`);
}
