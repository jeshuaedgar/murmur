export type TranscriptionOptions = {
  modelId: string;
  language?: string | null;
  translate?: boolean;
};

export type TranscriptionSegment = {
  startSec: number;
  endSec: number;
  text: string;
};

export type TranscriptionResult = {
  text: string;
  language?: string | null;
  durationMs: number;
  segments?: TranscriptionSegment[];
};

export type CleanupTextOptions = {
  language?: string | null;
  mode?: "off" | "rules" | "rules_plus_model";
  timeoutMs?: number;
};

export type CleanupTextResult = {
  rawText: string;
  cleanedText: string;
  strategy: "raw" | "rules" | "rules_plus_model";
  rejectedReason?: string | null;
};
