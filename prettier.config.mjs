// Consumers use @half-built/tooling/prettier; this repo dogfoods the same
// preset by relative path, since it cannot depend on its own package.
export { default } from "./packages/tooling/src/prettier.config.mjs";
