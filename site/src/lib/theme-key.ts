/* The one name for the theme choice in localStorage on this demo site.
   Base.astro passes it to Shell's first-paint stamp via the
   themeStorageKey prop, and to the theme-toggle island via its
   storageKey mount option. A separate module, not a literal, because
   both the server-rendered frontmatter and the client <script> module
   need the same value without duplicating the string. */
export const THEME_STORAGE_KEY = "hbui-demo-theme";
