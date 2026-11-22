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
  ])("reports %s", async (code) => {
    expect(await rules(code)).toContain(RULE);
  });

  it.each([
    [`a { background: white; background: ${MIX}; }`],
    [`a { background: white; /* tint */ background: ${MIX}; }`],
    ["a { max-height: calc(100vh - 4rem); max-height: calc(100dvh - 4rem); }"],
    [`a { --x: ${MIX}; }`],
    ["@supports (height: 100dvh) { a { max-height: calc(100dvh - 6rem); } }"],
    ['a { content: "100dvh"; }'],
    ['a { background: url("x-100dvh.png"); }'],
    [`a { Background: white; background: ${MIX}; }`],
  ])("passes %s", async (code) => {
    expect(await rules(code)).not.toContain(RULE);
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
