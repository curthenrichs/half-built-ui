/* Built-output check: every page in site/dist passes the tooling
   package's html-validate preset, the same preset consumers copy.
   Gated with the browser suite (BROWSER_TESTS=1, after
   `npm run build:site`), so plain `npm test` stays offline and needs
   no build. */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { HtmlValidate, type ConfigData } from "html-validate";

const enabled = process.env.BROWSER_TESTS === "1";
const DIST = fileURLToPath(new URL("../dist/", import.meta.url));

const PRESET = JSON.parse(
  readFileSync(
    new URL("../../packages/tooling/src/htmlvalidate.json", import.meta.url),
    "utf-8",
  ),
) as ConfigData;

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".html"))
    .map((f) => join(dir, f));
}

describe.skipIf(!enabled)("built html", () => {
  it("every built page passes the html-validate preset", async () => {
    expect(
      existsSync(DIST),
      "site/dist is missing; run npm run build:site",
    ).toBe(true);

    const files = htmlFiles(DIST);
    expect(files.length, "site/dist holds no pages").toBeGreaterThan(0);

    const hv = new HtmlValidate(PRESET);
    const failures: string[] = [];

    for (const file of files) {
      const report = await hv.validateFile(file);

      for (const m of report.results.flatMap((r) => r.messages)) {
        failures.push(
          `${file}:${String(m.line)}:${String(m.column)} ${m.ruleId} ${m.message}`,
        );
      }
    }

    expect(failures).toEqual([]);
  });
});
