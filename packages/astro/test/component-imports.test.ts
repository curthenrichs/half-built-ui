/* Package self-containment (step 11.3 task 4): a transitive-closure
   walk of every .astro file in the package, reduced from the blog's
   component-api "closure stays inside src/components or
   src/scripts/core" test to a plain boundary check. Every relative
   import specifier, at every depth, must resolve to a real file
   inside this package. Bare specifiers (astro, astro:assets) and
   asset imports (svg and friends) are exempt: they are framework or
   data, not package code. This is the gate that catches a copied
   component whose dependency was missed. */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const COMPONENTS_ROOT = fileURLToPath(new URL("../src/components", import.meta.url));
const ASSET_RE = /\.(svg|png|jpe?g|gif|webp|avif)$/;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]);
}

const astroFiles = () => walk(COMPONENTS_ROOT).filter((f) => f.endsWith(".astro"));

function readCode(file: string): string {
  const raw = readFileSync(file, "utf-8");
  return file.endsWith(".astro") ? raw.split("---")[1] ?? "" : raw;
}

function importSpecs(code: string): string[] {
  return [
    ...code.matchAll(/(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g),
    ...code.matchAll(/import\s*["']([^"']+)["']/g),
  ].map((m) => m[1]);
}

const rel = (p: string) => relative(PACKAGE_ROOT, p).split("\\").join("/");

describe("component self-containment", () => {
  it("every relative import in the transitive closure resolves to a file inside the package", () => {
    const roots = astroFiles();
    const seen = new Set<string>();
    const files = [...roots];
    const offenders: string[] = [];

    for (const file of files) {
      if (seen.has(file)) continue;
      seen.add(file);
      for (const spec of importSpecs(readCode(file))) {
        if (!spec.startsWith(".")) continue;
        if (ASSET_RE.test(spec)) continue;
        const base = resolve(dirname(file), spec);
        const candidates = [base, `${base}.ts`, `${base}.mjs`];
        const resolved = candidates.find((c) => existsSync(c));
        if (!resolved) {
          offenders.push(`${rel(file)} imports "${spec}" (no file at ${candidates.map(rel).join(", ")})`);
          continue;
        }
        if (!resolved.startsWith(PACKAGE_ROOT)) {
          offenders.push(`${rel(file)} imports "${spec}" resolving outside the package (${resolved})`);
          continue;
        }
        files.push(resolved);
      }
    }
    expect(offenders).toEqual([]);
    expect(seen.size).toBeGreaterThanOrEqual(roots.length);
  });
});
