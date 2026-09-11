// @vitest-environment jsdom
/* The shared localStorage codec (step 10): read/validate/write with
   private-mode degradation, extracted from henry-loose.ts and
   stasis-state.ts. */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { storedJson } from "../src/scripts/core/storage";

interface Toy {
  n: number;
}

const parse = (raw: string | null): Toy | null => {
  if (raw === null) return null;

  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null) return null;
    const { n } = v as Record<string, unknown>;
    return typeof n === "number" ? { n } : null;
  } catch {
    return null;
  }
};

describe("storedJson", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("round trips through write and read", () => {
    const store = storedJson<Toy>("toy", parse);
    store.write({ n: 7 });
    expect(store.read()).toEqual({ n: 7 });
  });

  it("returns null for an absent key", () => {
    expect(storedJson<Toy>("toy", parse).read()).toBeNull();
  });

  it("clears junk on read instead of returning it", () => {
    localStorage.setItem("toy", "{broken");
    const store = storedJson<Toy>("toy", parse);
    expect(store.read()).toBeNull();
    expect(localStorage.getItem("toy")).toBeNull();
  });

  it("clear removes the key", () => {
    const store = storedJson<Toy>("toy", parse);
    store.write({ n: 1 });
    store.clear();
    expect(localStorage.getItem("toy")).toBeNull();
  });

  it("degrades to null when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private mode");
    });

    expect(storedJson<Toy>("toy", parse).read()).toBeNull();
  });

  it("write swallows storage errors", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });

    expect(() => {
      storedJson<Toy>("toy", parse).write({ n: 1 });
    }).not.toThrow();
  });

  it("a custom serializer is used", () => {
    const store = storedJson<Toy>("toy", parse, (v) =>
      JSON.stringify({ n: v.n }),
    );

    store.write({ n: 3 });
    expect(localStorage.getItem("toy")).toBe('{"n":3}');
  });
});
