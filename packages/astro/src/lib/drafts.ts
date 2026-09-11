/* Draft visibility, pure and framework-free so it is unit-testable.
   A draft exists in the repo but not in the deploy build; a build run
   with SHOW_DRAFTS=1 includes it so the final look can be reviewed on
   a production preview build (never the dev server, per house rules).
   Every consumer goes through sortedPosts() in posts.ts, which applies
   this filter; a call site reaching for getCollection("posts") directly
   would leak drafts into whatever it renders. */

export interface Draftable {
  data: { draft?: boolean };
}

export function visiblePosts<T extends Draftable>(
  posts: T[],
  showDrafts: boolean,
): T[] {
  return showDrafts ? posts : posts.filter((p) => !p.data.draft);
}

/* Forward links. A published post may reference a post that is still a
   draft (the Táltos-oid build post teases its own reflection post, owner
   request 2026-08-24). The WhenPublished content component wraps that
   passage and renders it only once the target is visible, so the earlier
   post never has to be revised when the later one ships, and no link to a
   draft leaks into a deploy build. A slug that matches no post at all is
   a build error rather than a silently hidden paragraph: a typo must not
   look like "still a draft". */

export interface ForwardLinkable extends Draftable {
  data: { draft?: boolean; slug: string };
}

export function forwardLinkVisible(
  slug: string,
  posts: ForwardLinkable[],
  showDrafts: boolean,
): boolean {
  const target = posts.find((p) => p.data.slug === slug);
  if (!target) throw new Error(`WhenPublished: no post has slug "${slug}"`);
  return showDrafts || !target.data.draft;
}

/* Post links by slug. A hand-typed post URL bakes in the target's date,
   so a re-dated draft silently breaks every earlier link to it. The
   PostLink content component resolves the slug through postPath() at
   build time instead. It resolves drafts too, and must: Astro renders
   MDX slot children eagerly, so a PostLink inside a hidden WhenPublished
   still runs (learned the hard way 2026-08-24). The deploy-build guard
   against a bare link to a draft is therefore a test, not a throw here:
   test/post-link.test.ts asserts no draft slug appears in any built
   page. Unknown slugs throw for the same reason forwardLinkVisible's do. */

import { postPath } from "./slug";

export interface Linkable {
  data: { slug: string; date: Date };
}

export function resolvePostHref(slug: string, posts: Linkable[]): string {
  const target = posts.find((p) => p.data.slug === slug);
  if (!target) throw new Error(`PostLink: no post has slug "${slug}"`);
  return postPath(target);
}
