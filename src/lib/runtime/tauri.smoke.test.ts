import { describe, expect, it } from "vitest";
import { isTauriRuntime, requireTauri } from "@/lib/runtime/tauri";

describe("tauri runtime smoke", () => {
  it("guards tauri-only behavior in web mode", () => {
    expect(isTauriRuntime).toBe(false);
    expect(() => requireTauri("File transcription")).toThrow(/requires Tauri runtime/);
  });
});
