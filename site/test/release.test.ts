/* Release-gate pins for the three published packages. npm's provenance
   check (release.yml publishes over OIDC) refuses a tarball whose
   package.json "repository.url" does not name the repository the
   workflow ran in; v0.2.0's first attempt died on exactly that. The
   fixed-version rule from README's Release rules is pinned here too,
   and so is the bump discipline (owner, 2026-09-07): a package that
   changed since the last release tag must carry a version the tag
   does not, or the next tag would try to republish a taken number
   with different contents. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";

const REPO = "git+https://github.com/curthenrichs/half-built-ui.git";
const PACKAGES = ["packages/css", "packages/astro", "packages/tooling"];
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

interface Manifest {
  version: string;
  repository?: { type?: string; url?: string; directory?: string };
}

const manifest = (dir: string): Manifest =>
  JSON.parse(
    readFileSync(
      new URL(`../../${dir}/package.json`, import.meta.url),
      "utf-8",
    ),
  ) as Manifest;

const git = (...args: string[]): string =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf-8" }).trim();

/* Newest vX.Y.Z tag by version order. A shallow CI checkout may have
   none; one best-effort fetch fixes that, and an offline clone with
   no tags simply has nothing to compare against. */
function latestReleaseTag(): string | undefined {
  const list = () =>
    git("tag", "--list", "v*", "--sort=-v:refname").split("\n").filter(Boolean);

  let tags = list();

  if (tags.length === 0) {
    try {
      git("fetch", "--tags", "--depth=1", "--quiet");
    } catch {
      /* offline or no remote: fall through with whatever is local */
    }

    tags = list();
  }

  return tags[0];
}

describe("release metadata", () => {
  it("a package that changed since the last release tag carries a new version", () => {
    const tag = latestReleaseTag();
    if (tag === undefined) return;

    for (const dir of PACKAGES) {
      const tagged = (
        JSON.parse(git("show", `${tag}:${dir}/package.json`)) as Manifest
      ).version;

      /* Working tree against the tag, so an unstaged edit counts too. */
      const changed = git("diff", "--name-only", tag, "--", dir) !== "";

      if (changed) {
        expect(
          manifest(dir).version,
          `${dir} changed since ${tag} but still says ${tagged}; bump all three`,
        ).not.toBe(tagged);
      }
    }
  });

  it.each(PACKAGES)("%s names this repository for provenance", (dir) => {
    const { repository } = manifest(dir);
    expect(repository?.type).toBe("git");
    expect(repository?.url).toBe(REPO);
    expect(repository?.directory).toBe(dir);
  });

  it("the three packages share one version", () => {
    const versions = new Set(PACKAGES.map((dir) => manifest(dir).version));
    expect([...versions]).toHaveLength(1);
  });
});

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
    const checkout = verify.steps?.find((s) =>
      s.uses?.startsWith("actions/checkout"),
    );

    expect(checkout?.with?.["fetch-depth"]).toBe(0);
    const run = runText(verify);
    expect(run).toContain('"${GITHUB_REF_NAME#v}"');
    expect(run).toContain("packages/css packages/astro packages/tooling");
    expect(run).toContain('[ "$version" != "$tag_version" ]');
    expect(run).toContain("git fetch --quiet origin main");

    expect(run).toContain(
      'git merge-base --is-ancestor "$GITHUB_SHA" origin/main',
    );
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
