import { describe, it, expect } from "vitest";
import stylelint from "stylelint";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const presetPath = fileURLToPath(
  new URL("../src/stylelintrc.json", import.meta.url),
);

const preset = JSON.parse(readFileSync(presetPath, "utf-8")) as {
  rules: Record<string, unknown>;
};

const floor = JSON.parse(
  readFileSync(new URL("../src/browser-floor.json", import.meta.url), "utf-8"),
) as Record<string, string>;

/* web-features' own declarations import .ts files the typed lint cannot
   resolve, so the support data is read as JSON through a local type
   covering the one path used here. */
interface FeatureEntry {
  status?: {
    by_compat_key?: Record<string, { support: Record<string, string> }>;
  };
}

const features = (
  JSON.parse(
    readFileSync(
      createRequire(import.meta.url).resolve("web-features/data.json"),
      "utf-8",
    ),
  ) as { features: Record<string, FeatureEntry | undefined> }
).features;

interface BaselineOptions {
  available?: number | string;
  ignoreAtRules?: string[];
  ignoreSelectors?: string[];
  ignoreProperties?: Record<string, string[]>;
  ignoreFunctions?: string[];
  ignoreUnits?: string[];
}

const baseline = (): BaselineOptions | undefined => {
  const entry = preset.rules["plugin/use-baseline"] as
    [boolean, BaselineOptions] | undefined;

  return entry?.[1];
};

/* Every feature the 2021 Baseline bucket would flag but the preset
   lets through. An at-floor row is proven by its compat key's support
   data; a degrades row says what an older browser loses; a build-time
   row never reaches a browser. A property row with a value ignores only
   that value; without one it ignores the property. */
type Row = { key: string } & (
  | { verdict: "at-floor"; feature: string; compat: string }
  | { verdict: "degrades"; reason: string }
  | { verdict: "build-time"; reason: string }
);

const ALLOWLIST: Row[] = [
  {
    key: "atRule:layer",
    verdict: "at-floor",
    feature: "cascade-layers",
    compat: "css.at-rules.layer",
  },
  {
    key: "selector:focus-visible",
    verdict: "at-floor",
    feature: "focus-visible",
    compat: "css.selectors.focus-visible",
  },
  {
    key: "selector:backdrop",
    verdict: "at-floor",
    feature: "backdrop",
    compat: "css.selectors.backdrop.dialog",
  },
  {
    key: "property:overflow-wrap=anywhere",
    verdict: "at-floor",
    feature: "overflow-wrap",
    compat: "css.properties.overflow-wrap.anywhere",
  },
  {
    key: "property:align-self=start",
    verdict: "at-floor",
    feature: "flexbox",
    compat: "css.properties.align-self.start",
  },
  {
    key: "property:scroll-behavior",
    verdict: "at-floor",
    feature: "scroll-behavior",
    compat: "css.properties.scroll-behavior",
  },
  {
    key: "property:appearance",
    verdict: "at-floor",
    feature: "appearance",
    compat: "css.properties.appearance",
  },
  {
    key: "property:color-scheme",
    verdict: "at-floor",
    feature: "color-scheme",
    compat: "css.properties.color-scheme",
  },
  {
    key: "property:outline",
    verdict: "degrades",
    reason:
      "older Safari draws focus rings square instead of following the border radius",
  },
  {
    key: "property:overscroll-behavior",
    verdict: "degrades",
    reason: "a scrolled panel chains its scroll to the page underneath",
  },
  {
    key: "property:backdrop-filter",
    verdict: "degrades",
    reason: "no blur behind an overlay; the veil color still dims the page",
  },
  {
    key: "property:scrollbar-gutter",
    verdict: "degrades",
    reason: "content shifts a few pixels when a scrollbar appears",
  },
  {
    key: "property:forced-color-adjust",
    verdict: "degrades",
    reason: "only matters in forced-colors mode, which those browsers lack",
  },
  {
    key: "property:mask",
    verdict: "degrades",
    reason:
      "Chrome below 120 needs the -webkit-mask declaration placed before every unprefixed mask",
  },
  {
    key: "atRule:custom-media",
    verdict: "build-time",
    reason: "postcss-custom-media compiles it away before any browser sees it",
  },
];

/* A property ignored outright lists every value: the plugin checks
   values even when the property itself is skipped. */
const isWholeProperty = (vs: string[]): boolean =>
  vs.length === 1 && vs[0] === "/^.+$/";

/* The preset's allowlists as row keys. color-mix and the dynamic
   viewport units are not rows: half-built/require-fallback checks them
   instead. */
const FALLBACK_RULE_OWNED = new Set([
  "function:color-mix",
  "unit:dvh",
  "unit:svh",
  "unit:lvh",
]);

const presetKeys = (o: BaselineOptions): Set<string> => {
  const keys = [
    ...(o.ignoreAtRules ?? []).map((n) => `atRule:${n}`),
    ...(o.ignoreSelectors ?? []).map((n) => `selector:${n}`),
    ...Object.entries(o.ignoreProperties ?? {}).flatMap(([p, vs]) =>
      isWholeProperty(vs)
        ? [`property:${p}`]
        : vs.map((v) => `property:${p}=${v}`),
    ),
    ...(o.ignoreFunctions ?? []).map((n) => `function:${n}`),
    ...(o.ignoreUnits ?? []).map((n) => `unit:${n}`),
  ];

  return new Set(keys.filter((k) => !FALLBACK_RULE_OWNED.has(k)));
};

/* web-features may write a version as "≤15.4"; compare by dot segment. */
const atOrBelow = (version: string, limit: string): boolean => {
  const a = version.replace(/^≤/, "").split(".").map(Number);
  const b = limit.split(".").map(Number);

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);

    if (d !== 0) return d < 0;
  }

  return true;
};

const lint = async (code: string) => {
  const result = await stylelint.lint({
    code,
    codeFilename: "x.css",
    config: { extends: [presetPath] },
  });

  return result.results[0].warnings.map((w) => w.rule);
};

describe("browser floor lint", () => {
  it("the preset runs use-baseline at 2021", () => {
    expect(baseline()?.available).toBe(2021);
  });

  it("the preset leaves color-mix and the dynamic viewport units to the fallback rule", () => {
    expect(baseline()?.ignoreFunctions).toContain("color-mix");

    expect(baseline()?.ignoreUnits).toEqual(
      expect.arrayContaining(["dvh", "svh", "lvh"]),
    );
  });

  it("every allowlisted name has exactly one table row, and vice versa", () => {
    const rows = ALLOWLIST.map((r) => r.key);

    expect(new Set(rows).size).toBe(rows.length);
    expect([...presetKeys(baseline() ?? {})].sort()).toEqual([...rows].sort());
  });

  it.each(ALLOWLIST.filter((r) => r.verdict === "at-floor"))(
    "$key is supported at the floor",
    (row) => {
      const feature = features[row.feature];

      expect(feature, `web-features has no ${row.feature}`).toBeDefined();

      const support = feature?.status?.by_compat_key?.[row.compat]?.support;

      expect(support, `${row.feature} has no ${row.compat}`).toBeDefined();

      for (const [browser, limit] of Object.entries(floor)) {
        const version = support?.[browser];

        expect(version, `${row.compat} in ${browser}`).toBeDefined();

        expect(
          atOrBelow(version ?? "", limit),
          `${row.compat}: ${browser} ${version} is newer than the floor ${limit}`,
        ).toBe(true);
      }
    },
  );

  it.each(ALLOWLIST.filter((r) => r.verdict !== "at-floor"))(
    "$key carries a reason",
    (row) => {
      expect("reason" in row && row.reason.length > 0).toBe(true);
    },
  );

  it("reports a feature newer than the floor", async () => {
    expect(
      await lint(`a {
  container-type: inline-size;
}
`),
    ).toContain("plugin/use-baseline");
  });

  it("passes every value of a property allowlisted outright", async () => {
    expect(
      await lint(`a {
  outline: 2px solid currentColor;
}
`),
    ).not.toContain("plugin/use-baseline");
  });

  it("passes an allowlisted feature", async () => {
    expect(
      await lint(`@layer x {
  a {
    color: red;
  }
}
`),
    ).not.toContain("plugin/use-baseline");
  });
});
