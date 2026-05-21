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
