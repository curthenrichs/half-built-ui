# WhenPublished fallback and PostLink degrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `PostLink` to a hidden post renders its text instead of a link, and `WhenPublished` can render a `fallback` while its target is hidden, so a draft's name can never vanish from a sentence.

**Architecture:** One new pure function (`postLinkHref`) in the package's `lib/drafts.ts` decides link-or-text; the two content components read it (`PostLink`) or grow a named slot (`WhenPublished`). The package ships as 0.10.0 through the standing tag release. The blog then bumps its pin, updates its two wrappers, unwraps the 15 name-only `WhenPublished` uses, and adds a content guard so the pattern cannot come back.

**Tech Stack:** Astro 5.18 components and MDX, TypeScript, vitest, puppeteer-core browser suite, npm workspaces (half-built-ui), exact-pinned registry packages (blog).

**Spec:** `half-built-ui/docs/superpowers/specs/2026-09-26-when-published-fallback-design.md`

## Global Constraints

- Hidden-target `PostLink` output is the slot text alone: no element, no `class`, no `data-tooltip`, no styling.
- `WhenPublished` with no fallback renders byte-identical output to 0.9.0.
- An unknown slug still throws at build time, with the message shape `PostLink: no post has slug "x"`.
- `resolvePostHref` keeps resolving drafts and keeps its signature.
- Version: 0.10.0 across `@half-built/astro`, `@half-built/css`, `@half-built/tooling` (fixed versioning; `site/test/release.test.ts` enforces it).
- Release is Curt's step: merge to main, tag `v0.10.0`, push the tag. Never tag or push a tag in this plan.
- Blog: never patch `node_modules`; changes arrive by pin bump. Restart any running `astro dev` after the bump (Vite 504s otherwise).
- Blog: scratch builds go to the session scratchpad with an absolute `--outDir`, never inside the repo.
- No em dashes anywhere (code, comments, docs, content).
- Formatting is tooling-enforced: run `npx prettier --write <files>` on touched files, never hand-fix whitespace.

## Review Focus

1. A `WhenPublished` whose target IS visible and that carries a fallback: the fallback must not render. Pinned in Task 3's browser test.
2. A `PostLink` inside a hidden `WhenPublished` with no fallback: Astro renders MDX slot children eagerly, so its text must still not reach the page. Pinned in Task 3 (the existing "never renders" passage asserted absent).
3. A hidden `PostLink` that was given a `tip`: the tooltip must not leak into the page. Pinned in Task 3 (`data-tooltip="Sample draft"` absent).
4. A `SHOW_DRAFTS=1` build: a `PostLink` to a draft must be a real link. Pinned in Task 2 (`showDrafts` true resolves).
5. An author reintroducing `<WhenPublished><PostLink>Name</PostLink></WhenPublished>`: the blog must fail its suite. Pinned in Task 5's content guard.

---

### Task 1: Probe the MDX fallback-slot syntax (blog clone, throwaway)

The spec leaves one fact open: whether `<Fragment slot="fallback">` inside a component child in MDX reaches the component's named slot. This probe answers it with a local component in the blog, so the README (Task 4) documents syntax that works. Nothing from this task is committed.

**Files:**
- Create (temporary): `half-built-robots-blog/src/components/content/SlotProbe.astro`
- Create (temporary): `half-built-robots-blog/src/pages/slot-probe.mdx`

**Interfaces:**
- Produces: the MDX fallback syntax string used by Task 4's README and Task 6's house rule, either `<Fragment slot="fallback">` or `<span slot="fallback">`.

- [ ] **Step 1: Check for peer sessions and a clean tree**

Run `git -C C:/Users/curth/Documents/half-built-ecosystem/half-built-robots-blog status --short`. Expected: empty. If not empty, stop and ask Curt before continuing.

- [ ] **Step 2: Write the probe component**

`src/components/content/SlotProbe.astro`:

```astro
---
interface Props {
  show: boolean;
}
const { show } = Astro.props;
---

{show ? <slot /> : <slot name="fallback" />}
```

- [ ] **Step 3: Write the probe page**

`src/pages/slot-probe.mdx`:

```mdx
import SlotProbe from "../components/content/SlotProbe.astro";

A <SlotProbe show={false}>PROBE-MAIN<Fragment slot="fallback">PROBE-FRAGMENT</Fragment></SlotProbe> B

C <SlotProbe show={false}>PROBE-MAIN<span slot="fallback">PROBE-SPAN</span></SlotProbe> D
```

- [ ] **Step 4: Build to the scratchpad and read the result**

Run (bash):

```bash
cd C:/Users/curth/Documents/half-built-ecosystem/half-built-robots-blog
OUT="C:/Users/curth/AppData/Local/Temp/claude/C--Users-curth-Documents-half-built-ecosystem/7d4b466b-be46-4455-a4e8-77e1e5b3094b/scratchpad/slot-probe"
npx astro build --outDir "$OUT" 2>&1 | tail -3
grep -o "A .\{0,60\} B\|C .\{0,60\} D" "$OUT/slot-probe/index.html"
```

Expected: the A line contains `PROBE-FRAGMENT` and not `PROBE-MAIN` (Fragment works). If it does not, the C line must contain `PROBE-SPAN` (span works). Record which syntax works.

- [ ] **Step 5: Remove the probe**

```bash
rm src/components/content/SlotProbe.astro src/pages/slot-probe.mdx
rm -rf "$OUT"
git status --short
```

Expected: `git status --short` empty. Tell Curt the probe result in one line.

---

### Task 2: `postLinkHref` in `lib/drafts.ts`

**Files:**
- Modify: `half-built-ui/packages/astro/src/lib/drafts.ts` (the `Linkable` interface and the PostLink comment block at the end of the file)
- Test: `half-built-ui/packages/astro/test/lib.test.ts`

**Interfaces:**
- Produces: `export function postLinkHref(slug: string, posts: Linkable[], showDrafts: boolean): string | null` and `Linkable.data.draft?: boolean`.

- [ ] **Step 1: Branch**

```bash
cd C:/Users/curth/Documents/half-built-ecosystem/half-built-ui
git status --short   # expected empty; if not, stop and ask Curt
git switch -c feat/postlink-degrade dev
```

- [ ] **Step 2: Write the failing tests**

In `packages/astro/test/lib.test.ts`, add `postLinkHref` to the existing `../src/lib/drafts` import list, then append:

```ts
describe("postLinkHref", () => {
  const posts = [
    {
      data: {
        slug: "live",
        date: new Date("2026-09-01T00:00:00Z"),
        draft: false,
      },
    },
    {
      data: {
        slug: "soon",
        date: new Date("2026-09-08T00:00:00Z"),
        draft: true,
      },
    },
    { data: { slug: "bare", date: new Date("2026-09-02T00:00:00Z") } },
  ];

  it("resolves a published target to its route", () => {
    expect(postLinkHref("live", posts, false)).toBe("/2026/09/01/live/");
  });

  it("returns null for a draft so the link degrades to text", () => {
    expect(postLinkHref("soon", posts, false)).toBeNull();
  });

  it("resolves a draft when drafts are shown", () => {
    expect(postLinkHref("soon", posts, true)).toBe("/2026/09/08/soon/");
  });

  it("treats a missing draft field as published", () => {
    expect(postLinkHref("bare", posts, false)).toBe("/2026/09/02/bare/");
  });

  it("throws on a slug no post has, so a typo cannot pass as a draft", () => {
    expect(() => postLinkHref("typo", posts, false)).toThrow(
      /PostLink: no post has slug "typo"/,
    );
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run packages/astro/test/lib.test.ts`
Expected: FAIL, `postLinkHref` is not exported.

- [ ] **Step 4: Implement**

In `packages/astro/src/lib/drafts.ts`, change `Linkable` and add the function after `resolvePostHref`:

```ts
export interface Linkable {
  data: { slug: string; date: Date; draft?: boolean };
}

export function postLinkHref(
  slug: string,
  posts: Linkable[],
  showDrafts: boolean,
): string | null {
  const target = posts.find((p) => p.data.slug === slug);
  if (!target) throw new Error(`PostLink: no post has slug "${slug}"`);
  if (target.data.draft && !showDrafts) return null;
  return postPath(target);
}
```

Replace the PostLink comment block above `import { postPath }` with:

```ts
/* Post links by slug. A hand-typed post URL bakes in the target's date,
   so a re-dated draft silently breaks every earlier link to it. The
   PostLink content component resolves the slug through postPath() at
   build time instead. postLinkHref() is its policy: a visible target
   gets its href, a hidden one gets null and the component renders its
   text with no link (owner decision 2026-09-26), so a draft's name can
   sit in published prose and becomes a link on its own when the draft
   ships. resolvePostHref() still resolves drafts: consumers use it for
   lookups keyed by href, and Astro renders MDX slot children eagerly,
   so a PostLink inside a hidden WhenPublished still runs. The
   deploy-build guard against a link to a draft stays a consumer test
   (no draft slug in any built page). Unknown slugs throw for the same
   reason forwardLinkVisible's do. */
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run packages/astro/test/lib.test.ts`
Expected: PASS, including the unchanged `resolvePostHref` and `forwardLinkVisible` tests.

- [ ] **Step 6: Commit**

```bash
npx prettier --write packages/astro/src/lib/drafts.ts packages/astro/test/lib.test.ts
git add packages/astro/src/lib/drafts.ts packages/astro/test/lib.test.ts
git commit -m "feat(astro): postLinkHref, a hidden target degrades to text"
```

---

### Task 3: The components and the reference-site demo

**Files:**
- Modify: `half-built-ui/packages/astro/src/components/content/PostLink.astro`
- Modify: `half-built-ui/packages/astro/src/components/content/WhenPublished.astro`
- Modify: `half-built-ui/site/src/pages/index.astro` (the "When published and Post link" section, around lines 451-476)
- Test: `half-built-ui/site/test/browser.test.ts`

**Interfaces:**
- Consumes: `postLinkHref(slug, posts, showDrafts)` from Task 2.
- Produces: `PostLink` props `{ slug: string; posts: Linkable[]; showDrafts?: boolean; tip?: string; class?: string }`; `WhenPublished` named slot `fallback`.

- [ ] **Step 1: Write the failing browser test**

In `site/test/browser.test.ts`, after the `"only the forced demo editor note reaches the built page"` test, add:

```ts
  it("a PostLink to a draft degrades to text and a fallback stands in", async () => {
    const p = await open();
    const html = await p.content();

    /* The draft is never linked, and its tip never ships. */
    expect(html).not.toMatch(/href="[^"]*sample-draft/);
    expect(html).not.toContain('data-tooltip="Sample draft"');

    /* The name stays in the sentence as plain text. */
    const pending = await p.$eval(".sample-pending-link", (el) => ({
      text: el.textContent ?? "",
      links: el.querySelectorAll("a").length,
    }));
    expect(pending.text).toContain("the sample draft");
    expect(pending.links).toBe(0);

    /* A hidden passage shows its fallback; a visible one never does. */
    expect(html).toContain("This fallback stands in while the draft is unpublished.");
    expect(html).not.toContain("This passage waits for the draft.");
    expect(html).not.toContain("This passage never renders");
    expect(html).not.toContain("This fallback never renders");
  }, 30_000);
```

- [ ] **Step 2: Add the demo markup**

In `site/src/pages/index.astro`, replace the section's intro paragraph and the two existing `WhenPublished` blocks with:

```astro
          <p>
            Both take the consumer's post collection as a prop and read no
            content of their own. <code>PostLink</code> resolves a slug to the
            post's dated URL at build time, and renders plain text in place of
            a link while the post is a draft. <code>WhenPublished</code> renders
            its passage only once the post it names is visible, and its
            optional <code>fallback</code> slot renders until then. The sample
            collection here has one published post and one draft.
          </p>
          <WhenPublished slug="sample-published" posts={samplePosts}>
            <p>
              This passage is visible because its post is published. It links to
              <PostLink
                slug="sample-published"
                posts={samplePosts}
                tip="Sample post (September 1, 2026)"
                >the sample post</PostLink
              >, whose URL was resolved from the slug.
            </p>
            <p slot="fallback">This fallback never renders.</p>
          </WhenPublished>
          <p class="sample-pending-link">
            This sentence names
            <PostLink slug="sample-draft" posts={samplePosts} tip="Sample draft"
              >the sample draft</PostLink
            > in plain text, because its post is still a draft. It becomes a link
            when the post ships.
          </p>
          <WhenPublished slug="sample-draft" posts={samplePosts}>
            <p class="sample-draft-passage">
              This passage never renders, because its post is a draft.
            </p>
          </WhenPublished>
          <WhenPublished slug="sample-draft" posts={samplePosts}>
            <p>This passage waits for the draft.</p>
            <p slot="fallback">
              This fallback stands in while the draft is unpublished.
            </p>
          </WhenPublished>
```

- [ ] **Step 3: Build and run the browser test to verify failure**

```bash
npm run build:site
BROWSER_TESTS=1 npm run test:browser
```

Expected: the new test FAILS (the draft `PostLink` still renders an `<a>`, and the fallbacks do not render). Other browser tests pass.

- [ ] **Step 4: Implement `PostLink`**

`packages/astro/src/components/content/PostLink.astro`:

```astro
---
import { postLinkHref, type Linkable } from "../../lib/drafts";

interface Props {
  slug: string;
  posts: Linkable[];
  showDrafts?: boolean;
  tip?: string;
  class?: string;
}

const { slug, posts, showDrafts = false, tip, class: className } = Astro.props;
const href = postLinkHref(slug, posts, showDrafts);
---

{
  href ? (
    <a href={href} data-tooltip={tip} class={className}>
      <slot />
    </a>
  ) : (
    <slot />
  )
}
```

Check that the published-link output is unchanged: the JSX form must not add whitespace inside the `<a>`. If `npm run build:site` shows `<a ...> the sample post </a>` with added spaces, write the visible branch on one line: `href ? <a href={href} data-tooltip={tip} class={className}><slot /></a> : <slot />`.

- [ ] **Step 5: Implement `WhenPublished`**

`packages/astro/src/components/content/WhenPublished.astro`, last line becomes:

```astro
{visible ? <slot /> : <slot name="fallback" />}
```

- [ ] **Step 6: Build and run to verify pass**

```bash
npm run build:site
BROWSER_TESTS=1 npm run test:browser
grep -o '<a href="/2026/09/01/sample-published/"[^>]*>the sample post</a>' site/dist/index.html
```

Expected: all browser tests PASS; the grep prints the link with no whitespace inside the anchor.

- [ ] **Step 7: Commit**

```bash
npx prettier --write packages/astro/src/components/content/PostLink.astro packages/astro/src/components/content/WhenPublished.astro site/src/pages/index.astro site/test/browser.test.ts
git add packages/astro/src/components/content/PostLink.astro packages/astro/src/components/content/WhenPublished.astro site/src/pages/index.astro site/test/browser.test.ts
git commit -m "feat(astro): PostLink degrades to text, WhenPublished fallback slot"
```

---

### Task 4: README, version 0.10.0, full gates, hand to Curt

**Files:**
- Modify: `half-built-ui/packages/astro/README.md` (section "WhenPublished and PostLink")
- Modify: `half-built-ui/packages/astro/package.json`, `packages/css/package.json`, `packages/tooling/package.json` (version)
- Modify: `half-built-ui/package-lock.json` (workspace versions, via npm)

**Interfaces:**
- Consumes: Task 1's working MDX syntax.
- Produces: packages at version `0.10.0` on branch `feat/postlink-degrade`.

- [ ] **Step 1: Rewrite the README section**

Replace the body of `## WhenPublished and PostLink` with (use Task 1's syntax in the example; shown here with `Fragment`):

````markdown
`content/PostLink.astro` links to a post by slug and resolves the href
at build time through `postPath`, so a re-dated post does not strand
the links pointing at it. While the target is hidden (a draft, with the
draft gate off) it renders its text alone, with no element and no
styling, and becomes a link on its own when the post ships. That makes
it the right tool for a draft's name in published prose.

`content/WhenPublished.astro` renders its children only when the post
at `slug` is visible. Use it when a whole phrase only makes sense once
the post exists ("its own post", "see it here"). An optional `fallback`
slot renders while the target is hidden:

```mdx
<WhenPublished slug="my-draft">
  It has <PostLink slug="my-draft">its own post</PostLink> now.
  <Fragment slot="fallback">A post on it is coming.</Fragment>
</WhenPublished>
```

Both take the consumer's collection as the `posts` prop (the full
collection, drafts included, so an unknown slug can throw instead of
hiding as "still a draft") and the consumer's draft gate as
`showDrafts`. `PostLink` also accepts an optional `tip` carried as
`data-tooltip` for the link-tip island; a hidden `PostLink` drops it. A
consumer wraps each in a one-line site component that injects
`getCollection` and its own gate, the way the blog does. The resolvers
(`postLinkHref`, `resolvePostHref`, `forwardLinkVisible`) live in
`lib/drafts.ts` for consumers that want the logic without the
components.
````

- [ ] **Step 2: Bump the version**

```bash
npm version 0.10.0 --no-git-tag-version --workspace packages/astro --workspace packages/css --workspace packages/tooling
grep -n '"version"' packages/*/package.json
```

Expected: all three read `0.10.0`; `package-lock.json` updated.

- [ ] **Step 3: Full gates**

```bash
npm test
npm run lint
npm run build:site
BROWSER_TESTS=1 npm run test:browser
```

Expected: all pass. `site/test/release.test.ts` passes (changed packages carry a new, shared version). If the browser suite's teardown leaves preview servers behind, free their ports before rerunning.

- [ ] **Step 4: Commit and hand off**

```bash
npx prettier --write packages/astro/README.md
git add packages/astro/README.md packages/*/package.json package-lock.json
git commit -m "docs(astro): PostLink degrade and WhenPublished fallback; 0.10.0"
git switch dev && git merge --no-ff feat/postlink-degrade -m "Merge feat/postlink-degrade: PostLink degrade, WhenPublished fallback; 0.10.0"
git branch -d feat/postlink-degrade
```

Stop here. Tell Curt: dev carries 0.10.0, unpushed; release is his (push dev, PR to main, merge, tag `v0.10.0`, push the tag). Tasks 5 and 6 wait until `npm view @half-built/astro version` prints `0.10.0`.

---

### Task 5: Blog pin bump, wrappers, and the content guard

Runs only after 0.10.0 is on npm.

**Files:**
- Modify: `half-built-robots-blog/package.json`, `package-lock.json` (pins)
- Modify: `half-built-robots-blog/src/components/content/PostLink.astro`
- Modify: `half-built-robots-blog/src/components/content/WhenPublished.astro`
- Test: `half-built-robots-blog/test/post-link.test.ts`

**Interfaces:**
- Consumes: `postLinkHref` and `PostLink`'s `showDrafts` prop from `@half-built/astro@0.10.0`.
- Produces: blog wrappers with the same one-prop call sites (`<PostLink slug>`, `<WhenPublished slug>`), plus the `fallback` slot forwarded.

- [ ] **Step 1: Confirm the release and a clean tree**

```bash
cd C:/Users/curth/Documents/half-built-ecosystem/half-built-robots-blog
npm view @half-built/astro version   # expected 0.10.0
git status --short                   # expected empty; if not, ask Curt
git branch --show-current            # expected dev
```

- [ ] **Step 2: Write the failing content guard**

Append to `test/post-link.test.ts`:

```ts
/* The trap this guard closes (2026-09-26): a WhenPublished wrapped
   around nothing but a PostLink hid the post's NAME while the target
   was a draft, leaving "my Jetson Nano robot, , back" in production.
   A bare PostLink now renders its text until the post ships, so the
   wrapper is never needed around a name. */
describe("forward-link content", () => {
  it("no WhenPublished wraps only a PostLink to the same post", () => {
    const pattern =
      /<WhenPublished slug="([^"]+)">\s*<PostLink slug="\1">[^<]*<\/PostLink>\s*<\/WhenPublished>/;
    for (const dir of ["src/content/posts", "src/content/pages"]) {
      for (const f of readdirSync(dir).filter((n) => n.endsWith(".mdx"))) {
        const src = readFileSync(`${dir}/${f}`, "utf-8");
        expect(pattern.exec(src)?.[0], `${dir}/${f}`).toBeUndefined();
      }
    }
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run test/post-link.test.ts`
Expected: FAIL naming a file (the 15 uses are still there; the sweep is Task 6).

- [ ] **Step 4: Bump the pins**

```bash
npm install --save-exact @half-built/astro@0.10.0 @half-built/css@0.10.0 @half-built/tooling@0.10.0
grep -n '"@half-built' package.json
```

Expected: all three pinned `0.10.0`.

- [ ] **Step 5: Update the wrappers**

`src/components/content/PostLink.astro`:

```astro
---
import { getCollection } from "astro:content";
import PostLink from "@half-built/astro/content/PostLink.astro";
import { postLinkHref } from "@half-built/astro/lib/drafts.ts";
import { linkTip } from "../../lib/link-tips";
import { SHOW_DRAFTS } from "../../lib/posts";

interface Props {
  slug: string;
}

const { slug } = Astro.props;
const posts = await getCollection("posts");
const href = postLinkHref(slug, posts, SHOW_DRAFTS);
const tip = href ? await linkTip(href) : undefined;
---

<PostLink slug={slug} posts={posts} showDrafts={SHOW_DRAFTS} tip={tip}
  ><slot /></PostLink
>
```

`src/components/content/WhenPublished.astro`, the component call becomes:

```astro
<WhenPublished slug={slug} posts={posts} showDrafts={SHOW_DRAFTS}
  ><slot /><slot name="fallback" slot="fallback" /></WhenPublished
>
```

Run `npx prettier --write` on both files.

- [ ] **Step 6: Commit (the guard stays red until Task 6)**

Do not commit a red suite. Hold this commit and continue straight into Task 6; Task 6 Step 5 commits both tasks together.

---

### Task 6: Sweep, house rule, full verification, commit

**Files:**
- Modify: the 9 MDX files holding the 15 name-only wrappers (listed by Step 1's output, not by this plan)
- Modify: `half-built-robots-blog/CLAUDE.md` (the two `WhenPublished` / `PostLink` bullets under House rules)

**Interfaces:**
- Consumes: Task 5's wrappers and guard.

- [ ] **Step 1: Unwrap the name-only uses**

Write `sweep.mjs` in the session scratchpad (not the repo) and run it from the blog root:

```js
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const pattern =
  /<WhenPublished slug="([^"]+)">\s*(<PostLink slug="\1">[^<]*<\/PostLink>)\s*<\/WhenPublished>/g;
let total = 0;
for (const dir of ["src/content/posts", "src/content/pages"]) {
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".mdx"))) {
    const p = `${dir}/${f}`;
    const src = readFileSync(p, "utf-8");
    const n = [...src.matchAll(pattern)].length;
    if (n) {
      writeFileSync(p, src.replace(pattern, "$2"));
      console.log(`${n} ${p}`);
      total += n;
    }
  }
}
console.log(`total ${total}`);
```

Expected: `total 15` across 9 files (as of 2026-09-26). A different count is fine if content changed since; report the real number.

- [ ] **Step 2: Drop now-unused imports**

For each swept file, if `<WhenPublished` no longer appears in it, delete its `import WhenPublished from ...` line:

```bash
for f in $(git diff --name-only -- src/content); do
  grep -q "<WhenPublished" "$f" || sed -i '/^import WhenPublished from/d' "$f"
done
git diff --stat
```

- [ ] **Step 3: Rewrite the house rule**

In `CLAUDE.md`, replace the two bullets starting "Forward links to drafts go inside" and "Inside that wrapper, link the target" with:

```markdown
- Link a post by name with `<PostLink slug="...">`, never a typed URL,
  so a re-dated post does not strand the link. While the target is a
  draft, `PostLink` renders its text with no link and becomes a link on
  its own when the post ships, so a draft's name can sit in published
  prose unwrapped.
- A phrase that only makes sense once the target exists ("its own
  post", "see it here") goes inside `<WhenPublished slug="...">`, which
  renders nothing until then, or its `<Fragment slot="fallback">` while
  hidden. Never wrap a bare name in `WhenPublished`: hidden, it leaves a
  hole in the sentence, and the suite fails it. An unknown slug fails
  the build on purpose, and the suite fails any deploy build that
  mentions a draft slug.
```

(Use Task 1's syntax if it was `span`.)

- [ ] **Step 4: Full verification**

```bash
npx prettier --write CLAUDE.md $(git diff --name-only -- src/content) src/components/content/PostLink.astro src/components/content/WhenPublished.astro test/post-link.test.ts
npm run lint
npm test
npm run test:browser
```

Expected: lint clean; `npm test` all pass including the new guard; browser suites pass (a 10-second teardown hook timeout in `browser-smoke` and `a11y` predates this work on this machine; if it appears, confirm it also fails the same way with the change stashed, and report it rather than fixing it here).

Then the production parity check, both builds to the scratchpad:

```bash
S="C:/Users/curth/AppData/Local/Temp/claude/C--Users-curth-Documents-half-built-ecosystem/7d4b466b-be46-4455-a4e8-77e1e5b3094b/scratchpad"
npx astro build --outDir "$S/after" 2>&1 | tail -1
git stash push -q -- src/content CLAUDE.md
npx astro build --outDir "$S/before-content" 2>&1 | tail -1
git stash pop -q
diff -rq "$S/before-content" "$S/after" | grep -v "_astro/" | head -40
```

Expected: identical HTML. Every swept wrapper whose target is published rendered its link before and renders the same link after, and no published page wraps a draft by name as of 2026-09-26. Any differing page must be one whose target is a draft, and its only change must be the name appearing as plain text. Remove `$S/after` and `$S/before-content` afterward.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/content/PostLink.astro src/components/content/WhenPublished.astro test/post-link.test.ts CLAUDE.md $(git diff --name-only -- src/content)
git commit -m "Pin @half-built 0.10.0: PostLink names degrade to text, sweep name-only WhenPublished"
```

The commit body reports the swept count and the file count. Restart the blog's `astro dev` if one is running (the pin bump and `npm test` both stale it). Do not push; Curt pushes.
