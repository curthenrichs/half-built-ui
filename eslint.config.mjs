// Consumers use @half-built/tooling/eslint; this repo dogfoods the same
// preset by relative path, since it cannot depend on its own package.
import config from "./packages/tooling/src/eslint.config.mjs";

export default config;
