import { describe, expect, it } from "vitest";
import type { ExportTranscriptInput } from "@/lib/types/export";
import { formatTranscriptAsJson, formatTranscriptAsMd, formatTranscriptAsTxt } from "./export-formatters";

const sample: ExportTranscriptInput = {
  rawText: "uh hello world",
  cleanedText: "Hello world.",
  modelId: "small",
  language: "en",
  translated: false,
  sourceType: "recording",
  createdAt: "2026-05-21T00:00:00.000Z",
  cleanupStrategy: "rules",
  durationMs: 1234,
  audioPath: "/tmp/a.wav",
};

describe("export formatters", () => {
  it("formats txt from cleaned transcript by default", () => {
    expect(formatTranscriptAsTxt(sample)).toBe("Hello world.");
  });

  it("formats txt from raw transcript when requested", () => {
    expect(formatTranscriptAsTxt(sample, true)).toBe("uh hello world");
  });

  it("formats markdown with sections", () => {
    const md = formatTranscriptAsMd(sample);
    expect(md).toContain("# Murmur Transcript");
    expect(md).toContain("## Metadata");
    expect(md).toContain("## Cleaned Text");
    expect(md).toContain("## Raw Text");
    expect(md).toContain("Hello world.");
  });

  it("formats json as pretty payload", () => {
    const json = formatTranscriptAsJson(sample);
    const parsed = JSON.parse(json) as ExportTranscriptInput;
    expect(parsed.modelId).toBe("small");
    expect(parsed.cleanedText).toBe("Hello world.");
  });
});
