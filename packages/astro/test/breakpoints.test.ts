/* The cross-language breakpoint pin (step 11.1): the CSS definitions
   and the JS mirror cannot drift apart silently.

   Adapted (task 3): the CSS definitions now live in the sibling
   @half-built/css package, not this one, so this suite reaches across
   the workspace to packages/css/src/... A cross-package reach in a
   test is sanctioned for this file specifically (task 3 brief). Paths
   are resolved against this file's own URL rather than process.cwd()
   so the suite is not sensitive to whether vitest is invoked from
   packages/astro or the workspace root. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { BP_PHONE_MAX } from "../src/scripts/core/breakpoints";

const cssRoot = (rel: string) => readFileSync(new URL(`../../css/src/${rel}`, import.meta.url), "utf-8");
const css = () => cssRoot("tokens/breakpoints.css");

describe("system breakpoints", () => {
  it("defines exactly the four custom-media names", () => {
    const names = [...css().matchAll(/@custom-media (--bp-[a-z-]+)/g)].map((m) => m[1]);
    expect(names).toEqual(["--bp-phone", "--bp-phone-up", "--bp-sidebar", "--bp-tablet"]);
  });
  it("the JS mirror matches the CSS phone value", () => {
    const m = /--bp-phone \(max-width: (\d+)px\)/.exec(css());
    expect(m && Number(m[1])).toBe(BP_PHONE_MAX);
  });
  it("no system-breakpoint literal survives in styles or chrome components", () => {
    const files = [
      "base/scroll-top.css", "base/shell.css", "lightbox.css",
      "path-player.css", "plate-modal.css",
    ];
    for (const f of files) {
      const t = cssRoot(f);
      expect(t, f).not.toMatch(/\((?:max|min)-width: *(?:768|769|991|1024)px\)/);
    }
  });
});
