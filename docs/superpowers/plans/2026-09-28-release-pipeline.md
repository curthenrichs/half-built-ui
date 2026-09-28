# Release pipeline hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `v*` tag publishes only a commit on `main` whose version equals the tag, after the full CI (browser suite included) passes, from a publish job that runs nothing but the publish and can be rerun safely; CI runs read-only, once per push, with timeouts.

**Architecture:** `ci.yml` gains `workflow_call` and loses `pull_request`. `release.yml` becomes three chained jobs: `ci` (calls ci.yml, read-only), `verify` (tag equals version, commit on main), `publish` (the only job with `id-token: write`; pinned npm 11, no dependency install, a skip-if-published guard per package). Static tests parse both workflow files.

**Tech Stack:** GitHub Actions YAML, npm 11 trusted publishing (OIDC), vitest, js-yaml.

**Spec:** `docs/superpowers/specs/2026-09-28-release-pipeline-design.md`

## Global Constraints

- Work in `C:\Users\curth\Documents\half-built-ecosystem\half-built-ui` on branch `dev`. A peer session edits `site/src` in the same clone: stage files by explicit path only (`git add <paths>`), never `git add -A` or `git add .`; never switch branches.
- Never push, never create or push a tag, unless Curt says so at the time.
- Actions stay pinned by tag (`actions/checkout@v4`, `actions/setup-node@v4`); no SHA pins (owner ruling OPS-12).
- Publishing stays automatic on tag push: no GitHub environment, no approval step.
- Concurrency group prefixes are literals: `release-${{ github.ref }}` (cancel-in-progress false) and `ci-${{ github.ref }}` (cancel-in-progress true). Never `github.workflow` (inside a called workflow it names the caller).
- Publish order: `css`, `astro`, `tooling`. npm pinned as `npm@11`.
- No em dashes anywhere. Formatting by tooling: `npm run lint:fix`, then `npm run lint` clean.
- Running vitest rewrites `node_modules/.vite/deps`; the astro dev server on port 4321 must be restarted after `npm test` (kill by port, then `npx astro dev --port 4321` from `site/`).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

- `npm view @half-built/<name>@<version> version` for a version not yet on npm can print nothing and exit 0: the skip guard must compare the printed version to the manifest version, not trust the exit status. Pinned in Task 3.
- A tag whose version has a prerelease suffix (`v0.11.0-rc.1`) against manifests saying `0.11.0` must fail verify, not publish. The equality check covers it; pinned in Task 3 by asserting exact string equality on `${GITHUB_REF_NAME#v}`.
- A tag checkout has no `origin/main` ref: verify must fetch `main` before the ancestry check, or every release fails. Pinned in Task 3.
- A release's called CI must not join the release's concurrency group. Pinned in Task 2 (prefix `ci-`) and Task 3 (prefix `release-`).
- A rerun after a partial publish must resume: the publish loop continues past skipped packages. Pinned in Task 3 by the loop shape.

---

### Task 1: Prove publish needs no dependency install

**Files:** none changed. Scratch only: a fresh clone under the session scratchpad (never inside the repo).

**Interfaces:**
- Produces: a yes/no that Task 3 consumes. "No install needed" means Task 3's publish job has no `npm ci`; "install needed" means Task 3 adds `npm ci --ignore-scripts` with `PUPPETEER_SKIP_DOWNLOAD: "1"` before the publish loop and its test asserts that instead.

- [ ] **Step 1: Fresh clone without node_modules**

```bash
SCRATCH="C:/Users/curth/AppData/Local/Temp/claude/C--Users-curth-Documents-half-built-ecosystem/b9c2bdc4-c92e-47de-8869-63f719d448ea/scratchpad/publish-dry-run"
git clone --quiet --branch dev /c/Users/curth/Documents/half-built-ecosystem/half-built-ui "$SCRATCH"
ls "$SCRATCH/node_modules" 2>/dev/null && echo "UNEXPECTED node_modules" || echo "clean clone"
```

- [ ] **Step 2: Dry-run each publish**

```bash
cd "$SCRATCH"
for name in css astro tooling; do
  echo "== $name"
  npm publish --dry-run --workspace "packages/$name" --ignore-scripts 2>&1 | grep -E "npm notice (name|version|total files)|ERR" 
done
```

Expected: each prints `name: @half-built/<name>`, `version: 0.11.0`, and a total file count; no `ERR`. If any errors mention missing modules or workspaces, the answer is "install needed".

- [ ] **Step 3: Record the answer** in the ledger or report (no commit). Do not delete the scratch clone with `rm -rf` if it contains a `node_modules` junction; it has none here, so `rm -rf "$SCRATCH"` is safe after confirming Step 1 printed "clean clone".

---

### Task 2: ci.yml callable, read-only, once per push

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`, `package-lock.json` (root devDependencies: `js-yaml`, `@types/js-yaml`)
- Test: `site/test/release.test.ts`

**Interfaces:**
- Produces: `ci.yml` triggerable via `workflow_call` (Task 3's `ci` job calls it). Test helpers `workflow(name: string): Workflow` and the `Workflow`/`Job` interfaces in `site/test/release.test.ts`, reused by Task 3.

- [ ] **Step 1: Declare the YAML parser**

```bash
npm install --save-dev js-yaml@^4 @types/js-yaml@^4
```

Confirm root `package.json` devDependencies now list both, and `git diff --stat package-lock.json` shows only those entries changing.

- [ ] **Step 2: Write the failing tests** in `site/test/release.test.ts`. Add `import { load } from "js-yaml";` with the other imports, then after the existing `describe("release metadata", ...)` block:

```ts
interface Step {
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
}

interface Job {
  needs?: string | string[];
  uses?: string;
  permissions?: Record<string, string>;
  "timeout-minutes"?: number;
  steps?: Step[];
}

interface Workflow {
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  concurrency?: { group: string; "cancel-in-progress": boolean };
  jobs: Record<string, Job>;
}

const workflow = (name: string): Workflow =>
  load(
    readFileSync(
      new URL(`../../.github/workflows/${name}`, import.meta.url),
      "utf-8",
    ),
  ) as Workflow;

const runText = (job: Job): string =>
  (job.steps ?? []).map((s) => s.run ?? "").join("\n");

describe("ci workflow", () => {
  const ci = workflow("ci.yml");

  it("runs on branch pushes and when called, never on pull_request", () => {
    expect(Object.keys(ci.on).sort()).toEqual(["push", "workflow_call"]);
  });

  it("grants the token read-only contents and nothing else", () => {
    expect(ci.permissions).toEqual({ contents: "read" });
  });

  it("cancels a superseded run under a literal ci- prefix", () => {
    expect(ci.concurrency?.group).toBe("ci-${{ github.ref }}");
    expect(ci.concurrency?.["cancel-in-progress"]).toBe(true);
  });

  it("bounds every job with a timeout", () => {
    expect(ci.jobs.test["timeout-minutes"]).toBe(15);
    expect(ci.jobs.browser["timeout-minutes"]).toBe(20);
  });
});
```

- [ ] **Step 3: Run and see them fail**

Run: `npx vitest run site/test/release.test.ts`
Expected: the four `ci workflow` tests FAIL (keys include `pull_request`, no permissions, no concurrency, no timeouts).

- [ ] **Step 4: Rewrite `.github/workflows/ci.yml`**

```yaml
name: CI

# Branch pushes only: PRs here come from dev in this repo, so the push
# already tested the exact commit. release.yml calls this workflow on a
# tag, so the release runs the same gates, browser suite included.
on:
  push:
    branches: ["**"]
  workflow_call:

permissions:
  contents: read

# The prefix is a literal, never github.workflow: inside a called
# workflow that expression names the caller, so a CI run called by
# release.yml would join the release's own group and cancel or block it.
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
        with:
          # Full history so the release tags are present: the suite's
          # bump guard diffs each package against the newest vX.Y.Z tag.
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
        env: { PUPPETEER_SKIP_DOWNLOAD: "1" }
      - run: npm test
      - run: npm run lint
      - run: npm run build:site

  browser:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
        env: { PUPPETEER_SKIP_DOWNLOAD: "1" }
      - run: npm run build:site
      # Chrome is preinstalled at /usr/bin/google-chrome on ubuntu-latest;
      # test-kit/browser-server.ts's candidate list already finds it, so
      # no browser install step is needed here.
      - run: npm run test:browser
        env: { BROWSER_TESTS: "1" }
```

- [ ] **Step 5: Run and see them pass**

Run: `npx vitest run site/test/release.test.ts`
Expected: all tests PASS, including the existing release-metadata tests.

- [ ] **Step 6: Gates**, then restart the dev server on 4321 (see Global Constraints).

Run: `npm run lint:fix && npm run lint && npm test`
Expected: lint clean; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/ci.yml package.json package-lock.json site/test/release.test.ts
git commit -m "ci: callable, read-only, one run per push, with timeouts (OPS-3/OPS-11)"
```

(End the message with the Co-Authored-By line.)

---

### Task 3: release.yml gates, verify, publish

**Files:**
- Modify: `.github/workflows/release.yml`
- Test: `site/test/release.test.ts`

**Interfaces:**
- Consumes: `workflow(name)`, `runText(job)`, `Workflow`, `Job` from Task 2; Task 1's install answer.

- [ ] **Step 1: Write the failing tests** in `site/test/release.test.ts`, after the `ci workflow` block:

```ts
describe("release workflow", () => {
  const release = workflow("release.yml");
  const { ci, verify, publish } = release.jobs;

  it("runs on v* tags and never cancels a release in progress", () => {
    expect(release.on).toEqual({ push: { tags: ["v*"] } });
    expect(release.concurrency?.group).toBe("release-${{ github.ref }}");
    expect(release.concurrency?.["cancel-in-progress"]).toBe(false);
  });

  it("gives id-token to the publish job alone", () => {
    expect(release.permissions).toEqual({ contents: "read" });

    for (const [name, job] of Object.entries(release.jobs)) {
      if (name === "publish") {
        expect(job.permissions).toEqual({
          contents: "read",
          "id-token": "write",
        });
      } else {
        expect(job.permissions?.["id-token"], name).toBeUndefined();
      }
    }
  });

  it("chains ci, then verify, then publish", () => {
    expect(ci.uses).toBe("./.github/workflows/ci.yml");
    expect(ci.permissions).toEqual({ contents: "read" });
    expect(verify.needs).toBe("ci");
    expect(publish.needs).toBe("verify");
    expect(verify["timeout-minutes"]).toBe(5);
    expect(publish["timeout-minutes"]).toBe(10);
  });

  it("verifies the tag against every package version and main ancestry", () => {
    const checkout = verify.steps?.find((s) => s.uses?.startsWith("actions/checkout"));
    expect(checkout?.with?.["fetch-depth"]).toBe(0);
    const run = runText(verify);
    expect(run).toContain('"${GITHUB_REF_NAME#v}"');
    expect(run).toContain("packages/css packages/astro packages/tooling");
    expect(run).toContain('[ "$version" != "$tag_version" ]');
    expect(run).toContain("git fetch --quiet origin main");
    expect(run).toContain('git merge-base --is-ancestor "$GITHUB_SHA" origin/main');
  });

  it("publishes with pinned npm, no install scripts, resuming past published versions", () => {
    const run = runText(publish);
    expect(run).toContain("npm install -g npm@11");
    expect(run).not.toMatch(/npm@latest/);
    expect(run).toContain("for name in css astro tooling");
    /* npm view can print nothing and exit 0 for a missing version, so
       the guard compares the printed version, never the exit status. */
    expect(run).toContain(
      '[ "$(npm view "@half-built/$name@$version" version 2>/dev/null)" = "$version" ]',
    );

    const publishes = run.split("\n").filter((l) => l.includes("npm publish"));
    expect(publishes.length).toBeGreaterThan(0);
    for (const line of publishes) expect(line).toContain("--ignore-scripts");
  });

  it("publishes without installing the repo's dependencies", () => {
    expect(runText(publish)).not.toMatch(/npm (ci|install)(?! -g npm@)/);
  });
});
```

If Task 1 answered "install needed", replace the last test with one asserting `npm ci --ignore-scripts` is present and the step sets `PUPPETEER_SKIP_DOWNLOAD: "1"`.

- [ ] **Step 2: Run and see them fail**

Run: `npx vitest run site/test/release.test.ts`
Expected: the `release workflow` tests FAIL (no `ci`/`verify` jobs, workflow-level id-token, `npm@latest`).

- [ ] **Step 3: Rewrite `.github/workflows/release.yml`**

```yaml
name: release

on:
  push:
    tags: ["v*"]

permissions:
  contents: read

# Literal prefix (ci.yml uses ci-): a release is never cancelled midway.
concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

jobs:
  # The same gates CI runs on a branch push, browser suite included,
  # read-only. Publishing waits on all of them.
  ci:
    uses: ./.github/workflows/ci.yml
    permissions:
      contents: read

  verify:
    needs: ci
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: The tag names every package's version, and the commit is on main
        run: |
          tag_version="${GITHUB_REF_NAME#v}"
          for dir in packages/css packages/astro packages/tooling; do
            version=$(node -p "require('./$dir/package.json').version")
            if [ "$version" != "$tag_version" ]; then
              echo "::error::$dir says $version but the tag says $tag_version"
              exit 1
            fi
          done
          # A tag checkout has no origin/main ref; fetch it first.
          git fetch --quiet origin main
          if ! git merge-base --is-ancestor "$GITHUB_SHA" origin/main; then
            echo "::error::$GITHUB_SHA is not on main; releases publish from main only"
            exit 1
          fi

  # The only job that can mint an npm credential, so it runs nothing but
  # the publish: no dependency install (the packages ship src as-is and
  # define no scripts) and --ignore-scripts on every publish.
  publish:
    needs: verify
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      # Trusted publishing needs npm 11.5.1 or newer; pinned to the major
      # so a new npm cannot change publish behavior on release day.
      - run: npm install -g npm@11
      - name: Publish each package, skipping a version npm already has
        run: |
          # A rerun after a partial publish resumes here: npm view can
          # print nothing and exit 0 for a missing version, so compare
          # the printed version rather than trusting the exit status.
          for name in css astro tooling; do
            version=$(node -p "require('./packages/$name/package.json').version")
            if [ "$(npm view "@half-built/$name@$version" version 2>/dev/null)" = "$version" ]; then
              echo "@half-built/$name@$version is already on npm; skipping"
            else
              npm publish --workspace "packages/$name" --ignore-scripts
            fi
          done
```

If Task 1 answered "install needed", add before the publish step:

```yaml
      - run: npm ci --ignore-scripts
        env: { PUPPETEER_SKIP_DOWNLOAD: "1" }
```

- [ ] **Step 4: Run and see them pass**

Run: `npx vitest run site/test/release.test.ts`
Expected: all PASS.

- [ ] **Step 5: Check the shell by hand** (the tests read text; this runs it). From the repo root in Git Bash:

```bash
GITHUB_REF_NAME=v0.11.0 bash -c 'tag_version="${GITHUB_REF_NAME#v}"; for dir in packages/css packages/astro packages/tooling; do version=$(node -p "require(\"./$dir/package.json\").version"); [ "$version" != "$tag_version" ] && echo "MISMATCH $dir" ; done; echo checked'
GITHUB_REF_NAME=v0.11.0-rc.1 bash -c 'tag_version="${GITHUB_REF_NAME#v}"; for dir in packages/css; do version=$(node -p "require(\"./$dir/package.json\").version"); [ "$version" != "$tag_version" ] && echo "MISMATCH $dir"; done'
for name in css; do version=0.10.0; [ "$(npm view "@half-built/$name@$version" version 2>/dev/null)" = "$version" ] && echo "0.10.0 on npm: skip"; done
for name in css; do version=0.11.0; [ "$(npm view "@half-built/$name@$version" version 2>/dev/null)" = "$version" ] || echo "0.11.0 not on npm: publish"; done
```

Expected: first prints only `checked`; second prints `MISMATCH packages/css`; third prints `0.10.0 on npm: skip`; fourth prints `0.11.0 not on npm: publish`.

- [ ] **Step 6: Gates**, restart the dev server on 4321, then commit.

Run: `npm run lint:fix && npm run lint && npm test`

```bash
git add .github/workflows/release.yml site/test/release.test.ts
git commit -m "release: gates via ci.yml, verify tag and main, publish-only job that resumes (OPS-1/2/3/5/6)"
```

---

### Task 4: Docs say what the release enforces

**Files:**
- Modify: `README.md` (Release rules, the paragraph beginning "The first publish is run by hand")
- Modify: `CLAUDE.md` (Workflow and releases: the `Releases:` and `CI (`ci.yml`)` bullets)

- [ ] **Step 1: README.** Replace the sentence "The `release` workflow builds and publishes over OIDC, with no npm token stored anywhere." with:

```markdown
The `release` workflow runs the full CI, browser suite included, then
checks that the tag equals every package's version and that the tagged
commit is on `main`, and only then publishes over OIDC, with no npm
token stored anywhere. Only the publish job can mint the credential,
and it installs nothing. A release that fails partway can be rerun: a
version npm already has is skipped.
```

- [ ] **Step 2: CLAUDE.md.** Replace "`release.yml` runs the gates and publishes via npm trusted publishing (OIDC, no tokens, provenance automatic)." with "`release.yml` calls `ci.yml` (the full gates, browser suite included), verifies the tag equals the version and the commit is on main, then publishes via npm trusted publishing (OIDC, no tokens, provenance automatic); a rerun skips versions already on npm." Replace "on branch pushes; tag pushes fire only `release.yml`." with "on branch pushes (no `pull_request` trigger); a tag push fires only `release.yml`, which calls CI itself."

- [ ] **Step 3: Gates and commit**

Run: `npm run lint:fix && npm run lint`

```bash
git add README.md CLAUDE.md
git commit -m "docs: what a release now enforces"
```

---

### Task 5: Close-out

**Files:**
- Modify: `docs/superpowers/reviews/2026-09-27-code-audit.md` (the "Fixed on dev for 0.11.0" list and status line)

- [ ] **Step 1:** Full gates: `npm test`, `npm run lint`, `npm run build:site`, `BROWSER_TESTS=1 npm run test:browser` (port 4327 free first). Restart the dev server on 4321 afterwards.
- [ ] **Step 2:** Add OPS-1, OPS-2, OPS-3, OPS-5, OPS-6, OPS-11 with their commit hashes to the audit doc's fixed list; status line: batch 3 landed on dev, test gaps (batch 4) remain.
- [ ] **Step 3:** Commit by path: `git add docs/superpowers/reviews/2026-09-27-code-audit.md` and `git commit -m "docs: audit status after the release pipeline batch"`.
- [ ] **Step 4:** Report to Curt: push is his call; the optional rehearsal tag needs his go-ahead.
