// half-built/require-fallback: a declaration using a feature newer than
// the browser floor must come straight after a plain declaration of the
// same property, so a browser that drops the new value keeps the old
// one. The features are color-mix() and the dynamic viewport units,
// which the Baseline lint leaves to this rule. Custom properties are
// exempt: they cannot carry a fallback, and the declaration that reads
// them is the one checked.
import stylelint from "stylelint";

const {
  createPlugin,
  utils: { report, ruleMessages, validateOptions },
} = stylelint;

export const ruleName = "half-built/require-fallback";

export const messages = ruleMessages(ruleName, {
  missing: (prop, feature) =>
    `${prop} uses ${feature}, newer than the browser floor; put a plain ${prop} declaration directly before it (see the @half-built/tooling README, Browser support floor)`,
});

const meta = {
  url: "https://github.com/curthenrichs/half-built-ui/tree/main/packages/tooling#browser-support-floor",
};

const FEATURES = [
  { name: "color-mix()", pattern: /\bcolor-mix\(/i },
  { name: "a dynamic viewport unit", pattern: /\d(?:dvh|svh|lvh)\b/i },
];

/* Strings and url() contents can mention a feature without using it. */
const stripLiterals = (value) =>
  value
    .replace(/url\([^)]*\)/gi, "url()")
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');

const featureIn = (value) => {
  const bare = stripLiterals(value);

  return FEATURES.find((f) => f.pattern.test(bare));
};

/* @type {import('stylelint').Rule} */
const rule = (primary) => (root, result) => {
  if (!validateOptions(result, ruleName, { actual: primary })) return;

  root.walkDecls((decl) => {
    if (decl.prop.startsWith("--")) return;

    const feature = featureIn(decl.value);

    if (!feature) return;

    /* An @supports block that tests the same feature is a fallback
       too: browsers without it skip the block. */
    for (let p = decl.parent; p; p = p.parent) {
      if (
        p.type === "atrule" &&
        p.name.toLowerCase() === "supports" &&
        feature.pattern.test(p.params)
      ) {
        return;
      }
    }

    let prev = decl.prev();

    while (prev?.type === "comment") prev = prev.prev();

    const covered =
      prev?.type === "decl" &&
      prev.prop.toLowerCase() === decl.prop.toLowerCase() &&
      !featureIn(prev.value);

    if (covered) return;

    report({
      result,
      ruleName,
      node: decl,
      message: messages.missing(decl.prop, feature.name),
    });
  });
};

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;

export default createPlugin(ruleName, rule);
