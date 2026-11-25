/* The browser jobs in CI run inside Microsoft's Playwright images,
   which ship the browsers and their system libraries for one
   Playwright release, so nothing comes from apt (on the bare runner
   that step once took over 20 minutes). A package bump that leaves an
   image tag behind would launch browsers the installed release cannot
   drive, so each tag is held to its pin here. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { load } from "js-yaml";

const read = (path: string): string =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf-8");

interface Workflow {
  jobs: Partial<Record<string, { container?: string }>>;
}

const CI_TEXT = read(".github/workflows/ci.yml");
const CI = load(CI_TEXT) as Workflow;

const devDeps = (path: string): Record<string, string> =>
  (JSON.parse(read(path)) as { devDependencies: Record<string, string> })
    .devDependencies;

const image = (job: string): string | undefined =>
  /^mcr\.microsoft\.com\/playwright:v(\S+)-\w+$/.exec(
    CI.jobs[job]?.container ?? "",
  )?.[1];

describe("CI browser images", () => {
  it("pins playwright exactly, so it can match an image tag", () => {
    expect(devDeps("package.json").playwright).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("runs the engine smoke in the image for the pinned playwright", () => {
    expect(image("engines")).toBe(devDeps("package.json").playwright);
  });

  it("runs the floor suite in the image for its playwright release", () => {
    expect(`npm:playwright@${image("floor")}`).toBe(
      devDeps("site/floor/package.json").playwright,
    );
  });

  it("installs no browser system libraries with apt", () => {
    expect(CI_TEXT).not.toMatch(/playwright install(-deps| --with-deps)/);
  });
});
