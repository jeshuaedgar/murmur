import type { ExportTranscriptInput } from "@/lib/types/export";

function metadataLines(input: ExportTranscriptInput): string[] {
  return [
    `Created: ${input.createdAt}`,
    `Source: ${input.sourceType}`,
    `Model: ${input.modelId}`,
    `Language: ${input.language ?? "auto"}`,
    `Translated: ${input.translated ? "yes" : "no"}`,
    `Cleanup strategy: ${input.cleanupStrategy}`,
    `Duration (ms): ${input.durationMs ?? "n/a"}`,
    `Audio path: ${input.audioPath ?? "n/a"}`,
  ];
}

export function formatTranscriptAsTxt(input: ExportTranscriptInput, preferRaw = false): string {
  const body = preferRaw ? input.rawText : input.cleanedText;
  return body.trim();
}

export function formatTranscriptAsMd(input: ExportTranscriptInput): string {
  const lines = metadataLines(input).map((line) => `- ${line}`).join("\n");
  const cleaned = input.cleanedText.trim();
  const raw = input.rawText.trim();

  return [
    "# Murmur Transcript",
    "",
    "## Metadata",
    lines,
    "",
    "## Cleaned Text",
    cleaned || "_No cleaned transcript text._",
    "",
    "## Raw Text",
    raw || "_No raw transcript text._",
    "",
  ].join("\n");
}

export function formatTranscriptAsJson(input: ExportTranscriptInput): string {
  return JSON.stringify(input, null, 2);
}
