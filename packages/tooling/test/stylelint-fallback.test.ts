import { describe, it, expect } from "vitest";
import stylelint from "stylelint";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RULE = "half-built/require-fallback";

const pluginPath = fileURLToPath(
  new URL("../src/stylelint/require-fallback.mjs", import.meta.url),
);

const presetPath = fileURLToPath(
  new URL("../src/stylelintrc.json", import.meta.url),
);

const rules = async (code: string) => {
  const result = await stylelint.lint({
    code,
    codeFilename: "x.css",
    config: { plugins: [pluginPath], rules: { [RULE]: true } },
  });

  return result.results[0].warnings.map((w) => w.rule);
};

const MIX = "color-mix(in srgb, red 6%, white)";

describe("require-fallback rule", () => {
  it.each([
    [`a { background: ${MIX}; }`],
    ["a { min-height: 100dvh; }"],
    ["a { min-height: 100svh; }"],
    ["a { min-height: 100lvh; }"],
    ["@supports (display: grid) { a { min-height: 100dvh; } }"],
    [`a { color: red; background: ${MIX}; }`],
    [`a { background: ${MIX}; background: ${MIX}; }`],
    ["a { background: COLOR-MIX(in srgb, red 6%, white); }"],
    /* @supports not(...) runs exactly where the feature is missing. */
    ["@supports not (height: 100dvh) { a { min-height: 100dvh; } }"],
    /* An !important plain value beats the later color-mix everywhere,
       so the pair would never show the mix. */
    [`a { background: white !important; background: ${MIX}; }`],
    /* A custom property cannot carry a fallback: the var() that reads
       it wins the cascade and computes to nothing where the value is
       unsupported, so only an @supports guard covers it. */
    [`a { --x: ${MIX}; }`],
    ["a { --h: 100dvh; }"],
    /* A value holding var() or env() parses everywhere, so the plain
       value before it never takes over: where the feature is missing,
       the browser drops the value at computed time and the property
       acts as unset (a transparent background in Safari 15.4, Firefox
       98, and Chrome 99). Only an @supports guard covers it. */
    [
      "a { background: white; background: color-mix(in srgb, var(--a) 6%, white); }",
    ],
    ["a { max-height: 100vh; max-height: calc(100dvh - var(--gap)); }"],
    [
      "a { min-height: 100vh; min-height: calc(100dvh - env(safe-area-inset-bottom)); }",
    ],
  ])("reports %s", async (code) => {
    expect(await rules(code)).toContain(RULE);
  });

  it.each([
    [`a { background: white; background: ${MIX}; }`],
    [`a { background: white; /* tint */ background: ${MIX}; }`],
    ["a { max-height: calc(100vh - 4rem); max-height: calc(100dvh - 4rem); }"],
    [`@supports (color: color-mix(in srgb, red, red)) { a { --x: ${MIX}; } }`],
    ["@supports (height: 100dvh) { a { max-height: calc(100dvh - 6rem); } }"],
    [
      "@supports (color: color-mix(in srgb, red, red)) { a { background: color-mix(in srgb, var(--a) 6%, white); } }",
    ],
    ['a { content: "100dvh"; }'],
    ['a { background: url("x-100dvh.png"); }'],
    [`a { Background: white; background: ${MIX}; }`],
  ])("passes %s", async (code) => {
    expect(await rules(code)).not.toContain(RULE);
  });

  /* Chrome below 120 knows only -webkit-mask: a bare mask there leaves
     the element painting its background as a solid box. */
  it.each([
    ["a { mask: url('x.svg') center / contain no-repeat; }"],
    ["a { mask-image: url('x.svg'); }"],
    ["a { -webkit-mask: url('x.svg'); color: red; mask: url('x.svg'); }"],
  ])("reports an unprefixed %s", async (code) => {
    expect(await rules(code)).toContain(RULE);
  });

  it.each([
    ["a { -webkit-mask: url('x.svg'); mask: url('x.svg'); }"],
    ["a { -webkit-mask-image: url('x.svg'); mask-image: url('x.svg'); }"],
  ])("passes a prefixed pair %s", async (code) => {
    expect(await rules(code)).not.toContain(RULE);
  });

  it("the preset lets the -webkit-mask half of the pair through", async () => {
    const result = await stylelint.lint({
      code: `a {
  -webkit-mask: url('x.svg');
  mask: url('x.svg');
}
`,
      codeFilename: "x.css",
      config: { extends: [presetPath] },
    });

    expect(result.results[0].warnings.map((w) => w.rule)).toEqual([]);
  });

  it("names the property and the fix in its message", async () => {
    const result = await stylelint.lint({
      code: `a { background: ${MIX}; }`,
      codeFilename: "x.css",
      config: { plugins: [pluginPath], rules: { [RULE]: true } },
    });

    expect(result.results[0].warnings[0]?.text).toContain(
      "put a plain background declaration directly before it",
    );
  });

  it("names the @supports fix for a value holding var()", async () => {
    const result = await stylelint.lint({
      code: "a { background: white; background: color-mix(in srgb, var(--a) 6%, white); }",
      codeFilename: "x.css",
      config: { plugins: [pluginPath], rules: { [RULE]: true } },
    });

    expect(result.results[0].warnings[0]?.text).toContain(
      "wrap it in an @supports block",
    );
  });

  /* A consumer extends the preset from node_modules and lints from its
     own root: the plugin path must resolve against the preset file. */
  it("fires through the preset from another directory", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hb-fallback-"));

    try {
      const file = join(dir, "x.css");

      writeFileSync(
        file,
        `a {
  background: ${MIX};
}
`,
      );

      const result = await stylelint.lint({
        files: [file],
        cwd: dir,
        config: { extends: [presetPath] },
      });

      expect(result.results[0].warnings.map((w) => w.rule)).toContain(RULE);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
