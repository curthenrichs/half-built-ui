/* The house badge conventions (scripts/core/badges.ts): constants every
   consuming site spells the same way. The guest badge marks a post by
   someone other than the site's owner (owner design 2026-11-21). */
import { describe, it, expect } from "vitest";
import {
  GENAI_BADGE,
  DEMO_BADGE,
  GUEST_BADGE,
} from "../src/scripts/core/badges";
import { iconMarkup } from "../src/scripts/core/icons";

describe("house badges", () => {
  it("GUEST_BADGE is the house guest convention", () => {
    expect(GUEST_BADGE).toEqual({ key: "guest", label: "Guest", icon: "user" });
  });

  it("every house badge names a glyph in the registry", () => {
    for (const badge of [GENAI_BADGE, DEMO_BADGE, GUEST_BADGE]) {
      expect(iconMarkup(badge.icon), badge.key).toMatch(/<svg[^>]*>.+<\/svg>/);
    }
  });
});
