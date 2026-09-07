/* Fill every [data-token-hex] cell (Palette entries carrying `token`)
   with the token's computed value, and keep them current: the values
   move when the theme flips (data-theme on <html>) and when the
   palette editor writes its inline overrides (style on <html>), so
   one attribute observer covers both. Site-side on purpose: the
   Palette component stays inert markup and this page is the consumer
   that wants the live readout. */
export function mountTokenHexes(root: Document): void {
  const cells = [...root.querySelectorAll<HTMLElement>("[data-token-hex]")];
  if (cells.length === 0) return;
  const html = root.documentElement;

  const fill = (): void => {
    const computed = root.defaultView?.getComputedStyle(html);
    if (!computed) return;
    for (const cell of cells) {
      const token = cell.getAttribute("data-token-hex");
      if (!token) continue;
      cell.textContent = computed.getPropertyValue(token).trim();
    }
  };

  fill();
  const observer = new MutationObserver(fill);
  observer.observe(html, { attributes: true, attributeFilter: ["style", "data-theme"] });
}
