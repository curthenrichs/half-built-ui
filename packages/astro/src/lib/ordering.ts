/* Publication-time ordering, pure and framework-free so it is unit-testable.
   Single source of truth for a post's publication instant: `date` is the
   date-only permalink field; `published` carries the full source timestamp
   when a consumer's import knew it. Every consumer (sorting, feeds,
   display) must go through these instead of picking fields ad hoc:
   hand-picked fields are how the same-day ordering bug shipped twice. */

export interface Publishable {
  data: { date: Date; published?: Date; slug?: string };
}

export function publishedAt(p: Publishable): Date {
  return p.data.published ?? p.data.date;
}

/* The one newest-first comparator. Never hand-write a date sort expression
   at a call site; use this. Posts that share a publish instant (several
   date-only posts on one day) fall back to slug order, compared by code
   unit so no locale changes it: a content loader yields entries in no
   fixed order, and without the tiebreak which tied posts made a "recent"
   list could change from one build to the next. A consumer that wants
   its own order among them gives the posts real `published` times. */
export function byNewest(a: Publishable, b: Publishable): number {
  const byTime = +publishedAt(b) - +publishedAt(a);
  if (byTime !== 0) return byTime;

  const sa = a.data.slug ?? "";
  const sb = b.data.slug ?? "";

  if (sa === sb) return 0;

  return sa < sb ? -1 : 1;
}
