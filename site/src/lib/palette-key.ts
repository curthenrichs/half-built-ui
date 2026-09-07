/* The one name for the palette override in localStorage on this demo
   site. The palette-editor island reads and writes it directly, and
   Base.astro passes it as the storageKey mount option so the value is
   not duplicated between the two. */
export const PALETTE_STORAGE_KEY = "hbui-palette";
