#!/usr/bin/env bash
# Packs the three packages and proves they install and run for a
# consumer holding only what they declare: no workspace, no repo
# node_modules. The release runs it before publishing; run it from the
# repo root before a tag to find out early. npm installs required peers
# on its own; optional peers the smoke exercises are added at their
# declared ranges.
set -euo pipefail

# Node creates and deletes the work dir, never mktemp or a recursive
# rm: Git Bash's recursive rm follows Windows directory junctions out of
# the tree it was given, and fs.rmSync removes a link without walking
# it. The delete also refuses any path outside the OS temp dir. The
# path comes back with forward slashes so a Windows temp path works in
# both bash and node.
WORK="$(node -p 'require("fs").mkdtempSync(require("path").join(require("os").tmpdir(),"half-built-pack-smoke-")).split(require("path").sep).join("/")')"
cleanup() {
  # Windows cannot remove a directory that is a process's working dir,
  # and by exit the shell sits inside the consumer.
  cd /
  node -e 'const fs=require("fs"),os=require("os"),path=require("path");const d=path.resolve(process.argv[1]);const t=path.resolve(os.tmpdir());if(!process.argv[1]||!d.startsWith(t+path.sep)){console.error("refusing to delete "+d);process.exit(1)}fs.rmSync(d,{recursive:true,force:true})' "$WORK"
}
trap cleanup EXIT
mkdir -p "$WORK/tarballs" "$WORK/consumer"

for name in css astro tooling; do
  npm pack --silent --workspace "packages/$name" --pack-destination "$WORK/tarballs" >/dev/null
done

# Read from the repo root by a relative path: node on Windows cannot
# open Git Bash's /c/... form, and a path with spaces or quotes never
# has to survive being pasted into JavaScript.
htmlvalidate_range=$(node -p "require('./packages/tooling/package.json').peerDependencies['html-validate']")

cd "$WORK/consumer"
npm init -y >/dev/null
npm install --no-audit --no-fund "$WORK"/tarballs/*.tgz "html-validate@$htmlvalidate_range"

cat > eslint.config.mjs <<'EOF'
export { default } from "@half-built/tooling/eslint";
EOF
cat > prettier.config.mjs <<'EOF'
export { default } from "@half-built/tooling/prettier";
EOF
cat > .stylelintrc.json <<'EOF'
{ "extends": ["@half-built/tooling/stylelint"] }
EOF
printf 'export const answer = 42;\n' > sample.js
printf 'a {\n  color: var(--ink);\n}\n' > sample.css
printf -- '---\n---\n\n<p>Sample</p>\n\n<style>\n  p {\n    color: var(--ink);\n  }\n</style>\n' > sample.astro
printf '<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>Sample</title>\n  </head>\n  <body>\n    <main><p>Sample</p></main>\n  </body>\n</html>\n' > sample.html

echo "== eslint preset"; npx --no-install eslint sample.js
echo "== prettier preset"; npx --no-install prettier --check sample.js
echo "== stylelint preset (css and astro)"; npx --no-install stylelint sample.css sample.astro
echo "== html-validate preset"
node --input-type=module -e '
import { createRequire } from "node:module";
import { HtmlValidate } from "html-validate";
const require = createRequire(import.meta.url);
const preset = require("@half-built/tooling/htmlvalidate");
const report = await new HtmlValidate(preset).validateFile("sample.html");
if (!report.valid) { console.error(JSON.stringify(report.results, null, 2)); process.exit(1); }
'
echo "== exports resolve"
node --input-type=module -e '
for (const spec of ["@half-built/css/tokens", "@half-built/astro/components/Popout.astro", "@half-built/tooling/test-kit/browser-server.ts"]) {
  console.log(spec, "->", import.meta.resolve(spec));
}
'
echo "pack smoke passed"
