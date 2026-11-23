import { defineConfig } from "vitest/config";

/* Deliberately empty. Without a config here, vitest run from site/
   (the test:browser script) walks up to the root vitest.config.ts,
   takes the root's vitest.workspace.ts with it, and resolves those
   project paths under site/, failing at startup. This file stops the
   walk; the root workspace still runs site/ as one of its projects. */
export default defineConfig({});
