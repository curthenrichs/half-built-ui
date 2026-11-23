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

  /* Each raster figure (the wide BlogImage, and a Step photo smaller
     than its 400px rendition, so the width clamps) links a webp the
     page already serves in that figure's srcset, not an extra file,
     and carries the original. */
  it("each raster figure links a webp from its own srcset and carries the original", () => {
    const html = readFileSync(join(DIST, "index.html"), "utf-8");

    const figures = [
      ...html.matchAll(/<a\b[^>]*data-lb-original="[^"]+"[^>]*>[\s\S]*?<\/a>/g),
    ].map((m) => m[0]);

    expect(figures.length).toBeGreaterThanOrEqual(2);

    for (const figure of figures) {
      const href = /\shref="([^"]+)"/.exec(figure)?.[1] ?? "";
      const original = /data-lb-original="([^"]+)"/.exec(figure)?.[1] ?? "";
      const srcset = /srcset="([^"]+)"/.exec(figure)?.[1] ?? "";

      expect(href, figure).toMatch(/\.webp$/);
      expect(original, figure).toMatch(/\.png$/);

      expect(
        srcset.split(",").map((c) => c.trim().split(" ")[0]),
        figure,
      ).toContain(href);

      expect(existsSync(join(DIST, original)), original).toBe(true);
    }
  });
});
