import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* startPreview without a real server or a real Chrome: spawn is a
   stub, existsSync answers no for every Chrome candidate, and fetch is
   stubbed per test. */
const spawned = { pid: 4343, exitCode: null as number | null };
let didSpawn = false;

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    didSpawn = true;
    return spawned;
  }),
  spawnSync: vi.fn(() => ({ status: 0 })),
}));

vi.mock("node:fs", () => ({ existsSync: () => false }));
vi.spyOn(process, "kill").mockImplementation(() => true);

/* A server that answers on one loopback address only, once spawned. */
function answersOn(host: string) {
  return vi.fn((url: string): Response => {
    if (didSpawn && new URL(url).host === host) {
      return new Response("", { status: 200 });
    }

    throw new Error(`ECONNREFUSED ${url}`);
  });
}

describe("startPreview", () => {
  beforeEach(() => {
    didSpawn = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("still fails before serving when no Chrome is found, by default", async () => {
    vi.stubGlobal("fetch", answersOn("localhost:4998"));
    const { startPreview } = await import("../src/test-kit/browser-server.js");

    await expect(startPreview(4998, "/")).rejects.toThrow(/Chrome not found/);
    expect(didSpawn).toBe(false);
  });

  it("serves without a Chrome when the caller drives its own browsers", async () => {
    vi.stubGlobal("fetch", answersOn("localhost:4998"));
    const { startPreview } = await import("../src/test-kit/browser-server.js");

    await expect(
      startPreview(4998, "/", { requireChrome: false }),
    ).resolves.toBe(spawned);
  });

  /* astro preview binds "localhost" to whichever address the resolver
     hands it first: in a container that can be ::1 alone, while Node's
     fetch tries 127.0.0.1. */
  it.each(["[::1]:4998", "127.0.0.1:4998"])(
    "sees a server that binds only %s",
    async (host) => {
      vi.stubGlobal("fetch", answersOn(host));

      const { startPreview } =
        await import("../src/test-kit/browser-server.js");

      await expect(
        startPreview(4998, "/", { requireChrome: false }),
      ).resolves.toBe(spawned);
    },
  );

  it("refuses a port something already serves on ::1", async () => {
    didSpawn = true; // answersOn treats the server as up from the start
    vi.stubGlobal("fetch", answersOn("[::1]:4998"));
    const { startPreview } = await import("../src/test-kit/browser-server.js");

    await expect(
      startPreview(4998, "/", { requireChrome: false }),
    ).rejects.toThrow(/already serves/);
  });
});
