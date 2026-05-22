import { describe, expect, it } from "vitest";
import { shouldApplyAutoPaste } from "./auto-paste-guard";

describe("shouldApplyAutoPaste", () => {
  it("blocks duplicates for same completion id", () => {
    const seen = new Set<string>();
    expect(shouldApplyAutoPaste(seen, "file:1")).toBe(true);
    expect(shouldApplyAutoPaste(seen, "file:1")).toBe(false);
  });

  it("evicts oldest id when capacity is exceeded", () => {
    const seen = new Set<string>();
    expect(shouldApplyAutoPaste(seen, "a", 2)).toBe(true);
    expect(shouldApplyAutoPaste(seen, "b", 2)).toBe(true);
    expect(shouldApplyAutoPaste(seen, "c", 2)).toBe(true);
    expect(seen.has("a")).toBe(false);
    expect(seen.has("b")).toBe(true);
    expect(seen.has("c")).toBe(true);
  });
});
