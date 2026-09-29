/* Package lib (step 11.2): the post date formatter, split from
   post-display.ts so the package's formatDate never drags a
   site-specific placeholder along. Locale parameterized for N sites;
   en-US is the house default. */
export function formatPostDate(d: Date, locale = "en-US"): string {
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
