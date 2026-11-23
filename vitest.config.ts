import { defineConfig } from "vitest/config";

/* Coverage for `npm run test:coverage` (CI's test job), reported and
   never gated. It measures the packages' TypeScript and .mjs only:
   the Astro components render in the site build, in another process,
   so v8 cannot see them; html.test.ts, the browser suites, and
   site/floor cover those through the built pages. The projects
   themselves are listed in vitest.workspace.ts. */
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.{ts,mjs}"],
      reporter: ["text", "text-summary"],
    },
  },
});
