/* Publication-time ordering, pure and framework-free so it is unit-testable.
   Single source of truth for a post's publication instant: `date` is the
   date-only permalink field; `published` carries the full WP timestamp when
   the migrator knew it. Every consumer (sorting, feeds, display) must go
   through these instead of picking fields ad hoc: hand-picked fields are how
   the same-day ordering bug shipped twice (audit A1/A2). */

export interface Publishable {
  data: { date: Date; published?: Date };
}

export function publishedAt(p: Publishable): Date {
  return p.data.published ?? p.data.date;
}

/* The one newest-first comparator. Never hand-write a date sort expression
   at a call site; use this. */
export function byNewest(a: Publishable, b: Publishable): number {
  return +publishedAt(b) - +publishedAt(a);
}
