import { describe, it, expect } from "vitest";
import stylelint from "stylelint";
import { readFileSync } from "node:fs";

const config = JSON.parse(
  readFileSync(new URL("../src/stylelintrc.json", import.meta.url), "utf-8"),
) as { rules: Record<string, unknown> };

/* The preset extends stylelint-config-standard, resolved from the
   tooling package. Only the z-index rule is under test here. */
const zWarnings = async (value: string, property = "z-index") => {
  const result = await stylelint.lint({
    code: `a {
  ${property}: ${value};
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

  it.each([
    "3",
    "calc(var(--z-panel) + 1)",
    "-1",
    "var(--z-x, 5)",
    "Var(--z-panel)",
  ])("reports z-index: %s", async (v) => {
    expect(await zWarnings(v)).toContain(
      "declaration-property-value-allowed-list",
    );
  });

  /* CSS property names are case-insensitive, so the browser applies
     Z-INDEX: 3 exactly like z-index: 3. The rule must see it too. */
  it.each(["Z-INDEX", "Z-Index"])("reports %s: 3", async (property) => {
    expect(await zWarnings("3", property)).toContain(
      "declaration-property-value-allowed-list",
    );
  });

  it.each([
    "auto",
    "var(--z-panel)",
    "var(--z-chat-widget)",
    "var(--z-chat-widget-under)",
  ])("allows z-index: %s", async (v) => {
    expect(await zWarnings(v)).toEqual([]);
  });
});
