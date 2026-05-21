export type ExportFormat = "txt" | "md" | "json";

export type ExportTranscriptInput = {
  rawText: string;
  cleanedText: string;
  modelId: string;
  language?: string | null;
  translated: boolean;
  sourceType: "recording" | "file" | "live" | "unknown";
  createdAt: string;
  cleanupStrategy: string;
  durationMs?: number | null;
  audioPath?: string | null;
};
