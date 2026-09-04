/* The masthead date box: "25, Aug 2026", the live theme's format. Rendered
   at build time as the no-JS fallback (SiteHeader.astro) and refreshed on
   load by Base.astro's script, from this one definition. */
export function formatHeaderDate(now: Date): string {
  return `${now.getDate()}, ${now.toLocaleDateString("en-US", { month: "short" })} ${now.getFullYear()}`;
}
