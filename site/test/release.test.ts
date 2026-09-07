/* Release-gate pins for the three published packages. npm's provenance
   check (release.yml publishes over OIDC) refuses a tarball whose
   package.json "repository.url" does not name the repository the
   workflow ran in; v0.2.0's first attempt died on exactly that. The
   fixed-version rule from README's Release rules is pinned here too. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const REPO = "git+https://github.com/curthenrichs/half-built-ui.git";
const PACKAGES = ["packages/css", "packages/astro", "packages/tooling"];

interface Manifest {
  version: string;
  repository?: { type?: string; url?: string; directory?: string };
}

const manifest = (dir: string): Manifest =>
  JSON.parse(readFileSync(new URL(`../../${dir}/package.json`, import.meta.url), "utf-8")) as Manifest;

describe("release metadata", () => {
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
