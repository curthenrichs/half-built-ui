// half-built/require-fallback: a value newer than the browser floor
// must come straight after a plain declaration of the same property, so
// a browser that drops the new value keeps the old one. The values are
// color-mix() and the dynamic viewport units, which the Baseline lint
// leaves to this rule; an @supports block testing the same feature also
// counts. Two cases cannot carry a fallback, so there only the
// @supports guard counts: a custom property (the var() reading it wins
// the cascade and computes to nothing), and any value that itself holds
// var(). Such a value parses everywhere, so the plain declaration
// before it never takes over; where the feature is missing the browser
// drops the value at computed time and the property falls to its
// initial value. The floor engines (site/floor) paint those
// backgrounds transparent. mask and mask-image are the other case: Chrome
// below 120 knows only the -webkit- forms, so the unprefixed declaration
// must come straight after its -webkit- twin.
import stylelint from "stylelint";

const {
  createPlugin,
  utils: { report, ruleMessages, validateOptions },
} = stylelint;

export const ruleName = "half-built/require-fallback";

const README = "see the @half-built/tooling README, Browser support floor";

export const messages = ruleMessages(ruleName, {
  missing: (prop, feature) =>
    `${prop} uses ${feature}, newer than the browser floor; put a plain ${prop} declaration directly before it (${README})`,
  custom: (prop, feature) =>
    `${prop} uses ${feature}, newer than the browser floor, and a custom property cannot carry a fallback; wrap it in an @supports block that tests the feature (${README})`,
  withVar: (prop, feature) =>
    `${prop} uses ${feature} with var(), newer than the browser floor; a browser without the feature drops the whole value at computed time rather than keeping a plain declaration before it, so wrap it in an @supports block that tests the feature (${README})`,
  prefix: (prop) =>
    `${prop} needs -webkit-${prop} directly before it: Chrome below 120 knows only the prefixed form (${README})`,
});

const meta = {
  url: "https://github.com/curthenrichs/half-built-ui/tree/main/packages/tooling#browser-support-floor",
};

const FEATURES = [
  { name: "color-mix()", pattern: /\bcolor-mix\(/i },
  { name: "a dynamic viewport unit", pattern: /\d(?:dvh|svh|lvh)\b/i },
];

const PREFIXED = new Set(["mask", "mask-image"]);

/* Strings and url() contents can mention a feature without using it. */
const stripLiterals = (value) =>
  value
    .replace(/url\([^)]*\)/gi, "url()")
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');

const featureIn = (value) => {
  const bare = stripLiterals(value);

  return FEATURES.find((f) => f.pattern.test(bare));
};

/* The declaration before this one, comments skipped. */
const previousDecl = (decl) => {
  let prev = decl.prev();

  while (prev?.type === "comment") prev = prev.prev();

  return prev?.type === "decl" ? prev : undefined;
};

/* A positive @supports test for the feature; @supports not (...) runs
   exactly where the feature is missing, so it never counts. */
const insideSupportsFor = (decl, feature) => {
  for (let p = decl.parent; p; p = p.parent) {
    if (
      p.type === "atrule" &&
      p.name.toLowerCase() === "supports" &&
      !/^\s*not\b/i.test(p.params) &&
      feature.pattern.test(p.params)
    ) {
      return true;
    }
  }

  return false;
};

/* @type {import('stylelint').Rule} */
const rule = (primary) => (root, result) => {
  if (!validateOptions(result, ruleName, { actual: primary })) return;

  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();

    if (PREFIXED.has(prop)) {
      if (previousDecl(decl)?.prop.toLowerCase() !== `-webkit-${prop}`) {
        report({
          result,
          ruleName,
          node: decl,
          message: messages.prefix(decl.prop),
        });
      }

      return;
    }

    const feature = featureIn(decl.value);

    if (!feature || insideSupportsFor(decl, feature)) return;

    if (prop.startsWith("--")) {
      report({
        result,
        ruleName,
        node: decl,
        message: messages.custom(decl.prop, feature.name),
      });

      return;
    }

    if (/\bvar\(/i.test(stripLiterals(decl.value))) {
      report({
        result,
        ruleName,
        node: decl,
        message: messages.withVar(decl.prop, feature.name),
      });

      return;
    }

    const prev = previousDecl(decl);

    /* An !important fallback would beat the new value everywhere. */
    if (
      prev?.prop.toLowerCase() === prop &&
      !featureIn(prev.value) &&
      !prev.important
    ) {
      return;
    }

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
