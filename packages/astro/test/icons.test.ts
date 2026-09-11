/* The icon registry is the only source of svg markup in the package
   (owner call 2026-09-10): a component draws through Icon.astro, a
   script through the ICON_* strings, and nothing inlines path data of
   its own. Font Awesome glyphs had crept into four templates that way,
   outside the ICONS-LICENSE attribution. */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  iconMarkup,
  ICON_SUN,
  ICON_PLAY,
  ICON_CHEVRON_LEFT,
} from "../src/scripts/core/icons";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("icon registry", () => {
  it("renders a named glyph at 1em, decorative and click-transparent", () => {
    const svg = iconMarkup("search");

    expect(svg).toMatch(
      /^<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none"/,
    );

    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('pointer-events="none"');
    expect(svg).toContain('<circle cx="11" cy="11" r="8"/>');
  });

  it("takes a pixel size, a stroke width, and a class", () => {
    const svg = iconMarkup("clock", {
      size: 12,
      strokeWidth: 2,
      class: "meta-icon",
    });

    expect(svg).toMatch(
      /^<svg class="meta-icon" viewBox="0 0 24 24" width="12" height="12"/,
    );

    expect(svg).toContain('stroke-width="2"');
  });

  it("keeps the script-facing constants on the registry", () => {
    expect(ICON_SUN).toBe(iconMarkup("sun"));
    expect(ICON_CHEVRON_LEFT).toBe(iconMarkup("chevron-left"));
    /* Play stays the one filled glyph. */
    expect(ICON_PLAY).toContain('fill="currentColor"');
  });

  it("no component or script inlines svg markup of its own", () => {
    const offenders = walk(SRC)
      .filter((p) => /\.(astro|ts)$/.test(p) && !p.endsWith("icons.ts"))
      .filter((p) => /<svg\b/.test(readFileSync(p, "utf-8")));

    expect(offenders).toEqual([]);
  });
});
