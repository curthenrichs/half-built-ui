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

  it("draws maximize-2, the enlarge glyph", () => {
    const svg = iconMarkup("maximize-2");

    expect(svg).toContain('<path d="M15 3h6v6"/>');
    expect(svg).toContain('<path d="M9 21H3v-6"/>');
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

  /* The css package's one copy of path data: the search clear button's
     mask in the joined-field pattern, since css cannot import the
     registry. It must stay the registry's x at the default stroke. */
  it("the search clear button's mask is the registry's x", () => {
    const css = readFileSync(
      fileURLToPath(new URL("../../css/src/patterns.css", import.meta.url)),
      "utf-8",
    );

    const mask = decodeURIComponent(
      /::-webkit-search-cancel-button\s*\{[^}]*?url\("data:image\/svg\+xml,([^"]+)"\)/.exec(
        css,
      )?.[1] ?? "",
    );

    /* The registry's markup in the data URI's single quotes. */
    const x = iconMarkup("x").replaceAll('"', "'");
    const paths = /(<path[^>]*\/>)+/.exec(x)?.[0] ?? "";
    const stroke = /stroke-width='[^']*'/.exec(x)?.[0] ?? "";

    expect(paths).not.toBe("");
    expect(mask).toContain(paths);
    expect(mask).toContain(stroke);
  });
});
