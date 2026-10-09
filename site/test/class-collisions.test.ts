/* Guard (after 0.15.0): a component's scoped style must never style a
   class the global stylesheets also define. Astro scoping adds an
   attribute to the element; it does not rename the class, so a global
   rule with the same name still matches. 0.15.0 added the global
   .plate-frame pattern while GalleryImage styled its own tile as
   .plate-frame, and every gallery tile picked up the pattern's corners
   and padding. This reads the package sources directly, so it fails at
   the moment a pattern name collides, before any page renders. It lives
   in the site's suite on purpose: the release guard counts any change
   under packages/ as a package change. */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CSS_SRC = join(ROOT, "packages/css/src");
const COMPONENTS = join(ROOT, "packages/astro/src/components");

function walk(dir: string, ext: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path, ext);
    return path.endsWith(ext) ? [path] : [];
  });
}

/* Class names in selector position. Comments, url(...) values and
   declaration values are stripped first, so a ".5px" or a data URI
   never reads as a class. */
function selectorClasses(css: string): Set<string> {
  const text = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/url\([^)]*\)/g, "")
    .replace(/:\s*[^;{}]*;/g, ";");

  const names = new Set<string>();

  for (const m of text.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) {
    names.add(m[1]);
  }

  return names;
}

/* A component's scoped <style> blocks, minus anything it hands to the
   global scope on purpose (:global(...) and is:global blocks). */
function scopedClasses(astro: string): Set<string> {
  const blocks = [...astro.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/g)]
    .filter((m) => !m[1].includes("is:global"))
    .map((m) => m[2].replace(/:global\((?:[^()]|\([^()]*\))*\)/g, ""));

  return selectorClasses(blocks.join("\n"));
}

const globalClasses = new Set(
  walk(CSS_SRC, ".css").flatMap((f) => [
    ...selectorClasses(readFileSync(f, "utf-8")),
  ]),
);

const components = walk(COMPONENTS, ".astro");

/* Deliberate overlaps: the component knowingly refines a global pattern
   it uses, rather than naming a private class that a pattern later
   took. Each needs a reason; a new overlap fails until it is renamed or
   added here on purpose, and an entry that no longer overlaps fails so
   the list cannot rot. Keyed by path under components/. */
const DELIBERATE: Record<string, Record<string, string>> = {
  "PostCard.astro": {
    "draft-stamp": "sizes and stacks the shared stamp for a card",
  },
  "SiteHeader.astro": {
    "screen-reader-text": "only excludes it, in .menu-toggle span:not(...)",
  },
  "content/Quote.astro": {
    "quote-attribution": "right-aligns the attribution prose.css spaces",
  },
};

const rel = (f: string): string =>
  f.slice(COMPONENTS.length + 1).replaceAll("\\", "/");

describe("class collisions between global patterns and component styles", () => {
  it("finds the global classes and the components it guards", () => {
    expect(globalClasses.has("plate-frame")).toBe(true);
    expect(globalClasses.has("bracket-frame")).toBe(true);
    expect(components.length).toBeGreaterThan(10);
  });

  it.each(components.map((f) => [rel(f), f]))(
    "%s styles no global class except on purpose",
    (name, file) => {
      const allowed = DELIBERATE[name] ?? {};

      const clashes = [...scopedClasses(readFileSync(file, "utf-8"))].filter(
        (c) => globalClasses.has(c) && !(c in allowed),
      );

      expect(clashes).toEqual([]);
    },
  );

  it.each(Object.entries(DELIBERATE))(
    "every deliberate overlap in %s still exists",
    (name, entries) => {
      const file = components.find((f) => rel(f) === name);
      expect(file, name).toBeDefined();
      const scoped = scopedClasses(readFileSync(file ?? "", "utf-8"));

      for (const c of Object.keys(entries)) {
        expect(scoped.has(c) && globalClasses.has(c), `${name}: ${c}`).toBe(
          true,
        );
      }
    },
  );

  it("would have caught the 0.15.0 gallery collision", () => {
    const old = `<div class="plate-frame"></div>
<style>
  .plate-frame { border: var(--stroke) solid var(--rule); }
</style>`;

    const clashes = [...scopedClasses(old)].filter((c) => globalClasses.has(c));
    expect(clashes).toEqual(["plate-frame"]);
  });
});
