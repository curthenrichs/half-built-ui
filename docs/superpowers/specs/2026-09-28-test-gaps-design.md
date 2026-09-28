# Test gaps and release guards (audit batch 4)

Date: 2026-09-28. Owner: Curt. Status: design approved in chat, awaiting
spec review.

Source: batch 4 of the 2026-09-27 code audit
(`docs/superpowers/reviews/2026-09-27-code-audit.md`: OPS-4's pack-smoke
half, OPS-7, OPS-8, OPS-10, OPS-16, TOOL-8), plus the carryovers from the
batch 3 reviews (`docs/superpowers/specs/2026-09-28-release-pipeline-design.md`).
Everything lands on `dev` before the `v0.11.0` tag. Nothing here changes
package contents, so no version bump.

## Goal

Every check CI runs depends only on this repo. CI catches a backwards
version bump, a site built against a stale published release, type
errors in shipped TypeScript (including `.astro` props), and a broken
html-validate preset. The release proves the packed tarballs install and
run for a consumer before anything publishes, and refuses to report
success when a tag was moved after a partial publish.

## Decisions

Settled with Curt on 2026-09-28.

1. The browser suite serves a fixture for the ecosystem endpoint by
   default, so axe audits the island-driven footer deterministically.
   The two footer tests keep testing the fallback by aborting.
2. The type gate is `tsc --noEmit` over all four projects plus
   `astro check` on the site.
3. The packaging smoke is install-and-run, and runs only in the release,
   before publish.
4. The html-validate preset is exercised by validating the built site,
   after fixing the index's current errors.

## 1. A hermetic browser suite (OPS-7)

- Fixture: `site/test/fixtures/ecosystem.json`, schema version 1, with a
  `ui` entry and neutral entries across two families, so the swapped
  list shows a self entry and more than one group. Labels and hrefs are
  neutral sample values (no real family properties).
- One helper installs request interception on a page before its first
  navigation, in one of two modes: `fixture` (default) answers any
  request whose URL contains `ecosystem.json` with the fixture as
  `application/json` and continues every other request; `abort` aborts
  that request and continues the rest. `open()` and `openPhone()` take
  the mode as an optional argument and install it before `goto`. The
  two footer tests pass `abort` instead of registering their own
  handler (two handlers on one request throw "already handled").
- `openPhone()` gains the same `evaluateOnNewDocument` storage clear
  that `open()` has.
- Every fixed sleep becomes a wait on the state its test then asserts
  (`waitForFunction` or `waitForSelector`). The footer fallback test
  counts aborted ecosystem requests in its abort handler and waits for
  three (the first attempt and two retries) before waiting for the
  baseline list. No sleep survives in `site/test/browser.test.ts`.

## 2. html-validate on the built site (TOOL-8)

- `site/test/html.test.ts` loads `packages/tooling/src/htmlvalidate.json`
  as its config and validates every `.html` file under `site/dist`,
  failing with each file's rule ids and messages.
- It runs with the browser suite: the site's `test:browser` script runs
  both files, gated by `BROWSER_TESTS=1`, so plain `npm test` stays
  offline and needs no build. It fails, not skips, when `site/dist` is
  missing under the gate.
- First, the index's current errors are fixed in site markup (16 today:
  3 `unique-landmark`, 13 `no-raw-characters`). Each is read before it
  is fixed; the expected shape is an `aria-label` on repeated landmarks
  and escaped raw characters in demo text or samples. A fix that would
  need a package component change is flagged, not made.

## 3. Version and pin guards (OPS-8, OPS-10)

- The bump guard in `site/test/release.test.ts` requires a changed
  package's version to be greater than the newest tag's version, by a
  numeric major.minor.patch comparison (a small local helper; no new
  dependency). Equal or lower fails and names the package, both
  versions, and the tag.
- A new test asserts each `@half-built/*` entry in `site/package.json`
  (dependencies and devDependencies) equals the shared package version.

## 4. Type gate (OPS-16)

- `@astrojs/check` joins the root devDependencies.
- A root `typecheck` script: `tsc --noEmit -p packages/css`,
  `-p packages/astro`, `-p packages/tooling`, `-p site`, then
  `astro check` run in `site/`. Any existing errors surfaced by the
  first run are fixed in the same change (the audit found tsc clean;
  `astro check` has not been run here before).
- `ci.yml`'s test job runs `npm run typecheck` after lint. The release
  inherits it through the call.
- README's workspace command list and CLAUDE.md's CI bullet name the new
  script.

## 5. Release pack smoke (OPS-4)

A `pack-smoke` job in `release.yml`: `needs: ci`, `contents: read` only,
`timeout-minutes: 10`, beside `verify`. `publish` needs both `verify`
and `pack-smoke`.

1. `npm pack --workspace` for css, astro and tooling into a temp
   directory outside the checkout.
2. A consumer project in another temp directory: a `package.json`
   depending on the three tarballs by file path plus exactly the
   tooling package's declared required peers (eslint, stylelint,
   prettier) and html-validate, `npm install` with
   `PUPPETEER_SKIP_DOWNLOAD=1` (no workspace, no repo node_modules
   visible).
3. Smoke, each step failing the job on error:
   - eslint with `@half-built/tooling/eslint` on a tiny `.js` file;
   - stylelint with `@half-built/tooling/stylelint` on a tiny `.css`
     and a tiny `.astro` file (proves stylelint-config-standard and
     postcss-html resolve from the tarball's dependencies);
   - prettier with `@half-built/tooling/prettier` checking a tiny file;
   - html-validate with the preset JSON on a tiny page;
   - `node -e` resolving `@half-built/css/tokens` and an
     `@half-built/astro/components/*` path through the exports maps.
4. The smoke script lives in the repo (`scripts/pack-smoke.sh`) so it can
   be run locally before a tag; the job calls it.
5. The consumer installs only what the packages declare. If the first
   local run shows a preset needs something undeclared (a likely
   candidate: `typescript`, which `typescript-eslint` requires), that is
   a TOOL-2/3-class package defect: it is fixed in the tooling
   manifest as part of this batch (0.11.0 is unreleased), never papered
   over by installing it in the smoke consumer.

## 6. Workflow test hardening and the moved-tag guard

- `site/test/release.test.ts`:
  - non-publish jobs: `permissions` is either absent or an object with
    no `id-token` (a `write-all` string fails);
  - the no-install check also rejects `npm i`, `npm it` and
    `npm install-test`;
  - the verify step's run text holds an `exit 1` inside both the version
    branch and the ancestry branch;
  - `pack-smoke` exists, is read-only, needs `ci`, and `publish` needs
    both `verify` and `pack-smoke`.
- Moved-tag guard in `publish`: when a version is already on npm, the
  loop reads `npm view @half-built/<name>@<version> gitHead` and fails,
  naming the package, if it differs from `$GITHUB_SHA`; equal means a
  true resume and the package is skipped. (Verified: npm records the
  publishing commit, for example css@0.10.0's gitHead equals the
  v0.10.0 commit.) The README recovery rule stays.

## Testing

- Test-first for every behavior: the release tests, the pin and bump
  guards, the html test (red on the current index before its fixes).
- Full gates at the end: `npm test`, `npm run lint`,
  `npm run typecheck`, `npm run build:site`,
  `BROWSER_TESTS=1 npm run test:browser`, and `scripts/pack-smoke.sh`
  run locally.
- A rehearsal like batch 3's, only with Curt's go-ahead at the time: a
  throwaway tag on `dev` must run CI and `pack-smoke` to green, fail at
  `verify`, and skip `publish`; then the tag is deleted.
