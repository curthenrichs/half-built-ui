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

const REPO = "git+https://github.com/curthenrichs/half-built-ui.git";
const PACKAGES = ["packages/css", "packages/astro", "packages/tooling"];
const ROOT = fileURLToPath(new URL("../../", import.meta.url));

interface Manifest {
  version: string;
  repository?: { type?: string; url?: string; directory?: string };
}

const manifest = (dir: string): Manifest =>
  JSON.parse(readFileSync(new URL(`../../${dir}/package.json`, import.meta.url), "utf-8")) as Manifest;

const git = (...args: string[]): string => execFileSync("git", args, { cwd: ROOT, encoding: "utf-8" }).trim();

/* Newest vX.Y.Z tag by version order. A shallow CI checkout may have
   none; one best-effort fetch fixes that, and an offline clone with
   no tags simply has nothing to compare against. */
function latestReleaseTag(): string | undefined {
  const list = () => git("tag", "--list", "v*", "--sort=-v:refname").split("\n").filter(Boolean);
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
      const tagged = (JSON.parse(git("show", `${tag}:${dir}/package.json`)) as Manifest).version;
      /* Working tree against the tag, so an unstaged edit counts too. */
      const changed = git("diff", "--name-only", tag, "--", dir) !== "";
      if (changed) {
        expect(manifest(dir).version, `${dir} changed since ${tag} but still says ${tagged}; bump all three`).not.toBe(tagged);
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
