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

  /* Crawlers follow hrefs, so no lightbox link may point at a raster
     original: the href is the page's own webp rendition and the
     original rides in data-lb-original for the lightbox script. SVGs
     pass through untransformed and link themselves. */
  it("no lightbox link's href is a raster original", () => {
    const links = htmlFiles(DIST).flatMap((file) =>
      [
        ...readFileSync(file, "utf-8").matchAll(
          /<a\b[^>]*class="lightbox-link[^"]*"[^>]*>/g,
        ),
      ].map((m) => [file, m[0]] as const),
    );

    expect(links.length).toBeGreaterThan(0);

    for (const [file, tag] of links) {
      const href = /\shref="([^"]+)"/.exec(tag)?.[1] ?? "";
      expect(href, `${file}: ${tag}`).not.toMatch(/\.(?:png|jpe?g)$/i);
    }
  });

  it("a raster figure links its own largest webp and carries the original", () => {
    const html = readFileSync(join(DIST, "index.html"), "utf-8");

    const figure = /<a\b[^>]*data-lb-original="[^"]+"[^>]*>[\s\S]*?<\/a>/.exec(
      html,
    )?.[0];

    if (!figure) throw new Error("no lightbox link carries data-lb-original");

    const href = /\shref="([^"]+)"/.exec(figure)?.[1] ?? "";
    const original = /data-lb-original="([^"]+)"/.exec(figure)?.[1] ?? "";
    const srcset = /srcset="([^"]+)"/.exec(figure)?.[1] ?? "";

    expect(href).toMatch(/\.webp$/);
    expect(original).toMatch(/\.png$/);

    /* The rendition the page already serves, not an extra file. */
    expect(srcset.split(",").map((c) => c.trim().split(" ")[0])).toContain(
      href,
    );

    expect(existsSync(join(DIST, original))).toBe(true);
  });
});
