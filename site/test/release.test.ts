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

/* Numeric major.minor.patch order: a string compare ranks 0.9.0 above
   0.10.0. The packages carry plain X.Y.Z versions (the fixed-version
   rule), so no prerelease handling is needed. */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }

  return 0;
}

describe("compareVersions", () => {
  it("orders by number, not by string", () => {
    expect(compareVersions("0.10.0", "0.9.0")).toBeGreaterThan(0);
    expect(compareVersions("0.9.0", "0.10.0")).toBeLessThan(0);
    expect(compareVersions("1.0.0", "0.99.99")).toBeGreaterThan(0);
    expect(compareVersions("0.11.0", "0.11.0")).toBe(0);
    expect(compareVersions("0.11.1", "0.11.0")).toBeGreaterThan(0);
  });
});

/* Plain release tags only: a tag like v0.12.0-rehearsal still sorts
   newest by git's --sort=-v:refname but is not a release, and letting
   it through would make it the bump guard's comparison point. Version
   order, not input order: the caller may hand these in any order. */
function newestReleaseTag(tags: string[]): string | undefined {
  const releases = tags.filter((t) => /^v\d+\.\d+\.\d+$/.test(t));

  return releases.reduce<string | undefined>(
    (newest, t) =>
      newest === undefined || compareVersions(t.slice(1), newest.slice(1)) > 0
        ? t
        : newest,
    undefined,
  );
}

describe("newestReleaseTag", () => {
  it("skips non-release tags and keeps version order", () => {
    expect(
      newestReleaseTag(["v0.10.0", "v0.12.0-rehearsal", "v0.9.0", "v0.11.0"]),
    ).toBe("v0.11.0");
  });

  it("returns undefined for no tags", () => {
    expect(newestReleaseTag([])).toBeUndefined();
  });
});

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

  return newestReleaseTag(tags);
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
          compareVersions(manifest(dir).version, tagged),
          `${dir} changed since ${tag} but ${manifest(dir).version} is not newer than ${tagged}; bump all three`,
        ).toBeGreaterThan(0);
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

  it("the site pins every @half-built package at the shared version", () => {
    const site = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf-8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const pins = Object.entries({
      ...site.dependencies,
      ...site.devDependencies,
    }).filter(([name]) => name.startsWith("@half-built/"));

    expect(pins.map(([name]) => name).sort()).toEqual([
      "@half-built/astro",
      "@half-built/css",
      "@half-built/tooling",
    ]);

    const version = manifest("packages/css").version;
    for (const [name, pin] of pins) expect(pin, name).toBe(version);
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
  permissions?: Record<string, string> | string;
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

/* The body of an `if ... ; then` branch, up to (not including) its
   own closing `fi` line: a lazy [\s\S]*?exit 1 regex can be satisfied
   by an exit 1 in a LATER branch when the branch it is meant to
   check has none of its own, so branch assertions scope to this
   instead of matching across the whole run text. */
function branchBody(run: string, ifLineMarker: string): string {
  const lines = run.split("\n");
  const start = lines.findIndex((l) => l.includes(ifLineMarker));
  if (start === -1) return "";

  const body: string[] = [];

  for (let i = start + 1; i < lines.length; i++) {
    if (/^\s*fi\b/.test(lines[i])) break;
    body.push(lines[i]);
  }

  return body.join("\n");
}

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

  it("type-checks after the site builds", () => {
    const runs = (ci.jobs.test.steps ?? []).map((s) => s.run ?? "");
    const build = runs.indexOf("npm run build:site");
    const typecheck = runs.indexOf("npm run typecheck");
    expect(build).toBeGreaterThan(-1);
    expect(typecheck).toBeGreaterThan(build);
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
        const perms = job.permissions;

        expect(
          perms === undefined ||
            (typeof perms === "object" && !("id-token" in perms)),
          `${name} may not hold id-token (or write-all)`,
        ).toBe(true);
      }
    }
  });

  it("chains ci, then verify, then publish", () => {
    expect(ci.uses).toBe("./.github/workflows/ci.yml");
    expect(ci.permissions).toEqual({ contents: "read" });
    expect(verify.needs).toBe("ci");
    expect(publish.needs).toEqual(["verify", "pack-smoke"]);
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

    expect(branchBody(run, '!= "$tag_version" ]')).toContain("exit 1");
    expect(branchBody(run, "--is-ancestor")).toContain("exit 1");
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

  it("smoke-tests the packed tarballs before publishing", () => {
    /* Record indexing types every key as present; a missing job is
       undefined at runtime, which is what the first assertion checks. */
    const smoke = release.jobs["pack-smoke"] as Job | undefined;
    expect(smoke).toBeDefined();
    expect(smoke?.needs).toBe("ci");
    expect(smoke?.permissions).toBeUndefined();
    expect(smoke?.["timeout-minutes"]).toBe(10);
    expect(runText(smoke ?? {})).toContain("bash scripts/pack-smoke.sh");
    expect(publish.needs).toEqual(["verify", "pack-smoke"]);
  });

  it("pack-smoke cleans up junction-safe, never with rm -rf", () => {
    const script = readFileSync(
      new URL("../../scripts/pack-smoke.sh", import.meta.url),
      "utf-8",
    );

    expect(script).not.toMatch(
      /\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i,
    );

    expect(script).toContain("os.tmpdir()");
    expect(script).toContain("fs.rmSync");
  });

  it("publishes without installing the repo's dependencies", () => {
    expect(runText(publish)).not.toMatch(
      /npm (ci|i|install|it|install-test)\b(?! -g npm@)/,
    );
  });

  it("fails a rerun whose published version came from another commit", () => {
    const run = runText(publish);
    expect(run).toContain('npm view "@half-built/$name@$version" gitHead');
    expect(run).toContain('"$(git rev-parse HEAD)"');
    expect(run).toMatch(/published_head[\s\S]*?exit 1/);
  });
});
