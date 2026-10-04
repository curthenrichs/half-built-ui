/* RFC 9116 security.txt (2026-10-03). Contact and Expires are the
   required fields, and a file past its Expires date is invalid, so this
   fails 60 days ahead of expiry: renewing it becomes a normal change
   instead of a silent lapse. */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const FILE = new URL("../public/.well-known/security.txt", import.meta.url);
const DAY = 24 * 60 * 60 * 1000;

describe("security.txt", () => {
  const txt = readFileSync(FILE, "utf-8");

  it("names a contact and its own canonical URL", () => {
    expect(txt).toMatch(/^Contact: mailto:\S+@\S+$/m);

    expect(txt).toContain(
      "Canonical: https://ui.half-built-robots.com/.well-known/security.txt",
    );
  });

  it("expires more than 60 days out and less than a year out", () => {
    const m = /^Expires: (\S+)$/m.exec(txt);
    expect(m).not.toBeNull();
    const left = Date.parse(m?.[1] ?? "") - Date.now();
    expect(left).toBeGreaterThan(60 * DAY);
    expect(left).toBeLessThanOrEqual(366 * DAY);
  });
});
