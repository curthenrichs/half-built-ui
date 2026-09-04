// Manifest-driven gate for step 11.3's move: reads scripts/move-manifest.json
// and, for every verbatim (adapted: false) entry, checks that the moved file
// in this repo still says the same thing the blog's copy does. Import lines
// are expected to differ (paths change when a file moves to a new package
// layout), so both sides get their import statements stripped by a small
// line scanner before the remainder is byte-compared. adapted: true entries
// are not diffed, just listed, so the adapted surface stays visible in the
// output rather than silently skipped.
//
// This is a tolerant line scanner, not a parser: it knows the handful of
// import/re-export shapes this codebase actually uses (single-line, the
// `import {` … `} from "...";` continuation, and CSS `@import`) and nothing
// more exotic. CSS is handled separately from JS/TS/Astro because CSS has no
// bare `import` keyword; a line scanner that treated any line starting with
// "import" as an import statement would also eat plain prose comments that
// happen to start with that word (this repo has one, in plate-modal.css).
// Requiring the `@` for CSS avoids that without needing to parse comments.
import { readFileSync, existsSync } from "node:fs";
import { extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const blogRoot = resolve(repoRoot, process.env.BLOG_REPO ?? "../half-built-robots-blog");

const manifestPath = resolve(repoRoot, "scripts/move-manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const IMPORT_START = /^import\b/;
const EXPORT_FROM_SINGLE = /^export\b.*\bfrom\s*["'][^"']*["']\s*;?\s*$/;
const EXPORT_BLOCK_START = /^export\s*\{\s*$/;
const CSS_IMPORT_START = /^@import\b/;

function isCssPath(path) {
  return extname(path) === ".css";
}

// Returns true when `line` ends the statement that a block started on
// (either the closing `from "...";` of a re-export/import, or a bare
// `";` when the statement is only a quoted specifier).
function closesStatement(line) {
  return /;\s*$/.test(line.trim());
}

// Strips import/re-export statements from `text`, line by line. `css`
// selects the CSS-only `@import` rule instead of the JS/TS/Astro rules.
function stripImports(text, css) {
  const lines = text.split("\n");
  const kept = [];
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (css) {
      if (CSS_IMPORT_START.test(trimmed)) {
        i = skipStatement(lines, i);
        continue;
      }
    } else if (IMPORT_START.test(trimmed)) {
      i = skipStatement(lines, i);
      continue;
    } else if (EXPORT_FROM_SINGLE.test(trimmed)) {
      // Single-line `export { ... } from "...";` already closes here.
      i += 1;
      continue;
    } else if (EXPORT_BLOCK_START.test(trimmed)) {
      // `export {` or `export` opening a multi-line block: only treat it
      // as a re-export (and strip it) if a `from "...";` shows up before
      // the statement closes. A plain multi-line `export { a, b };` with
      // no `from` is a local export, not an import surface, and stays.
      const end = findStatementEnd(lines, i);
      const block = lines.slice(i, end + 1).join("\n");
      if (/\bfrom\s*["'][^"']*["']\s*;?\s*$/.test(block.trim())) {
        i = end + 1;
        continue;
      }
    }
    kept.push(lines[i]);
    i += 1;
  }
  return kept.join("\n");
}

// Given the index of a statement's start line, returns the index of the
// line that closes it (the same index if the start line already closes).
function findStatementEnd(lines, startIndex) {
  let j = startIndex;
  while (j < lines.length && !closesStatement(lines[j])) {
    j += 1;
  }
  return j;
}

// Skips an import/@import statement starting at `startIndex`, returning
// the index of the first line after it.
function skipStatement(lines, startIndex) {
  return findStatementEnd(lines, startIndex) + 1;
}

let failures = 0;
let passed = 0;
let skipped = 0;

for (const entry of manifest.files) {
  const { from, to, adapted } = entry;
  if (adapted) {
    console.log(`SKIPPED (adapted) ${to}`);
    skipped += 1;
    continue;
  }

  const fromPath = resolve(blogRoot, from);
  const toPath = resolve(repoRoot, to);

  const fromExists = existsSync(fromPath);
  const toExists = existsSync(toPath);
  if (!fromExists || !toExists) {
    if (!fromExists) console.log(`MISSING (blog) ${from}`);
    if (!toExists) console.log(`MISSING (moved) ${to}`);
    failures += 1;
    continue;
  }

  const css = isCssPath(from) || isCssPath(to);
  const fromText = stripImports(readFileSync(fromPath, "utf8"), css);
  const toText = stripImports(readFileSync(toPath, "utf8"), css);

  if (fromText === toText) {
    passed += 1;
    continue;
  }

  const fromLines = fromText.split("\n");
  const toLines = toText.split("\n");
  const max = Math.max(fromLines.length, toLines.length);
  let firstDiff = max;
  for (let k = 0; k < max; k += 1) {
    if (fromLines[k] !== toLines[k]) {
      firstDiff = k + 1;
      break;
    }
  }
  console.log(`MISMATCH ${to} (first differing line ${firstDiff} after import-stripping)`);
  failures += 1;
}

console.log(`\n${passed} passed, ${skipped} skipped (adapted), ${failures} failed`);

if (failures > 0) {
  process.exit(1);
}
