# Release pipeline hardening

Date: 2026-09-28. Owner: Curt. Status: design approved in chat, awaiting
spec review.

Source: batch 3 of the 2026-09-27 code audit
(`docs/superpowers/reviews/2026-09-27-code-audit.md`, findings OPS-1,
OPS-2, OPS-3, OPS-5, OPS-6, OPS-11). OPS-12 is closed by owner ruling:
actions stay pinned by tag.

## Goal

A pushed `v*` tag publishes only code that is on `main`, whose version
equals the tag, and that passed every gate CI runs, the browser suite
included. The one job that can mint an npm credential runs nothing but
the publish. A release that fails partway can be rerun and resumes.
CI itself runs with read-only permissions, once per push, with
timeouts. The owner's release motion does not change: merge to main,
tag `vX.Y.Z`, push the tag.

## Decisions

Settled with Curt on 2026-09-28.

1. Publishing stays automatic once the tag is pushed: no GitHub
   environment and no approval click. The tag push is the deliberate
   act; the new gates catch the mistakes.
2. The release reuses CI's gates by calling `ci.yml` through
   `workflow_call`, so the release gates cannot drift from CI.
3. CI runs on every branch push and drops the `pull_request` trigger.
   PRs here come from `dev` in the same repo, so the push already
   tested the exact commit.

## release.yml

Top-level `permissions: contents: read`. A workflow-level concurrency
group `release-${{ github.ref }}` with `cancel-in-progress: false`, so a
release is never cancelled midway. Three jobs, each needing the one before.

1. `ci`: `uses: ./.github/workflows/ci.yml`, `permissions: contents:
   read`. Runs the same test and browser jobs as a branch push. Its
   test job's full-history checkout gives the bump guard real tags on a
   tag run.
2. `verify` (`needs: ci`, read-only, `timeout-minutes: 5`): checkout
   with `fetch-depth: 0`, then one shell step that fails with a named
   reason unless
   - `${GITHUB_REF_NAME#v}` equals the `version` in
     `packages/css`, `packages/astro` and `packages/tooling`, and
   - `git merge-base --is-ancestor "$GITHUB_SHA" origin/main` succeeds.
3. `publish` (`needs: verify`, `permissions: contents: read` and
   `id-token: write`, `timeout-minutes: 10`): checkout, `setup-node` at
   22 with the npm registry URL, `npm install -g npm@11` (trusted
   publishing needs npm 11.5.1 or newer). No install of the repo's
   dependencies: the packages ship `src` as-is and define no scripts.
   Then, for `css`, `astro`, `tooling` in that order: if
   `npm view @half-built/<name>@<version> version` returns the version,
   log that it is already published and skip; otherwise
   `npm publish --workspace packages/<name> --ignore-scripts`.
   Provenance stays automatic under trusted publishing.

Fallback, only if the dry run in Testing shows `npm publish --workspace`
needs installed dependencies: `npm ci --ignore-scripts` with
`PUPPETEER_SKIP_DOWNLOAD=1` before the publish loop.

## ci.yml

- Triggers: `push` on all branches, and `workflow_call`. No
  `pull_request`. A tag push does not trigger it directly.
- Top-level `permissions: contents: read`.
- Concurrency: group `ci-${{ github.ref }}` with
  `cancel-in-progress: true`. The prefix is a literal, never
  `github.workflow`: inside a called workflow that expression names the
  caller, so a called CI keyed on it would join the release's own group
  and cancel or block it. A called run carries the tag's ref, so it
  never shares a group with a branch run.
- `timeout-minutes`: 15 on `test`, 20 on `browser`.
- Unchanged: `fetch-depth: 0` on `test`, `PUPPETEER_SKIP_DOWNLOAD` on
  both installs, the runner's preinstalled Chrome for the browser job.

## Docs

- README release rules: state what the release now enforces (tag
  equals version, commit on main, full CI including the browser suite,
  rerun resumes a partial publish).
- CLAUDE.md "Workflow and releases": the tag-push bullet says tag
  pushes run `release.yml`, which calls CI; CI runs on branch pushes
  only.

## Testing

- Static assertions in `site/test/release.test.ts` on the parsed
  workflow files, using `js-yaml` declared as a root devDependency
  (already in the tree) with `@types/js-yaml`:
  - release.yml's top-level permissions grant no `id-token`; only the
    `publish` job does.
  - `publish` needs `verify`; `verify` needs `ci`; `ci` uses
    `./.github/workflows/ci.yml` with read-only permissions.
  - `publish` pins `npm@11`, passes `--ignore-scripts` to every publish,
    and guards each publish with `npm view`.
  - `verify` checks the tag against every package version and main
    ancestry.
  - ci.yml has `workflow_call`, no `pull_request`, read-only
    permissions, a timeout on every job, and a concurrency group whose
    literal prefix differs from release.yml's.
- A dry run: in a fresh clone of the branch outside the repo (scratch
  directory, no `node_modules`), `npm publish --dry-run --workspace
  packages/<name> --ignore-scripts` for each package lists the expected
  tarball files. This decides the install fallback.
- Optional rehearsal, only with Curt's go-ahead at the time: push a
  throwaway tag (for example `v0.0.0-rehearsal`) on `dev`; the release
  must run CI, fail at `verify` with the named reasons, and never reach
  `publish`; then delete the tag locally and on the remote.
