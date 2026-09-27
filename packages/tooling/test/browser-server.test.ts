import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const spawned = { pid: 4242, exitCode: null as number | null };

const spawnSync = vi.fn(
  (...args: unknown[]): { status: number; args: unknown[] } => ({
    status: 0,
    args,
  }),
);

const kill = vi.spyOn(process, "kill").mockImplementation(() => true);

vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => spawned),
  spawnSync: (...args: unknown[]) => spawnSync(...args),
}));

describe("startPreview", () => {
  beforeEach(() => {
    process.env.CHROME_PATH = process.execPath; // any existing file satisfies findChrome
    spawnSync.mockClear();
    kill.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CHROME_PATH;
  });

  it("kills the spawned server when the ready path 404s", async () => {
    let calls = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn((): Response => {
        calls++;
        if (calls === 1) throw new Error("nothing on the port yet");
        return new Response("", { status: 404 });
      }),
    );

    const { startPreview } = await import("../src/test-kit/browser-server.js");

    await expect(startPreview(4999, "/missing/")).rejects.toThrow(/404/);

    const killed =
      process.platform === "win32"
        ? spawnSync.mock.calls.some((c) => c[0] === "taskkill")
        : kill.mock.calls.some((c) => c[0] === -4242);

    expect(killed).toBe(true);
  });
});
