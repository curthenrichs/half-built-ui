import { describe, it, expect } from "vitest";
import stylelint from "stylelint";
import { readFileSync } from "node:fs";

const config = JSON.parse(
  readFileSync(new URL("../src/stylelintrc.json", import.meta.url), "utf-8"),
) as { rules: Record<string, unknown> };

/* The preset extends stylelint-config-standard, resolved from the
   tooling package. Only the z-index rule is under test here. */
const zWarnings = async (value: string) => {
  const result = await stylelint.lint({
    code: `a {
  z-index: ${value};
}
`,
    codeFilename: "x.css",
    config: {
      rules: {
        "declaration-property-value-allowed-list":
          config.rules["declaration-property-value-allowed-list"],
      },
    },
  });

  return result.results[0].warnings.map((w) => w.rule);
};

describe("z-index lint rule", () => {
  it("is present in the preset", () => {
    expect(
      config.rules["declaration-property-value-allowed-list"],
    ).toBeDefined();
  });

  it.each(["3", "calc(var(--z-panel) + 1)", "-1"])(
    "reports z-index: %s",
    async (v) => {
      expect(await zWarnings(v)).toContain(
        "declaration-property-value-allowed-list",
      );
    },
  );

  it.each(["auto", "var(--z-panel)", "var(--z-henry)", "var(--z-henry-under)"])(
    "allows z-index: %s",
    async (v) => {
      expect(await zWarnings(v)).toEqual([]);
    },
  );
});
