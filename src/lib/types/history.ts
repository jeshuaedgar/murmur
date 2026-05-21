export type TranscriptionSourceType = "recording" | "file" | "live";

export type TranscriptionRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  sourceType: TranscriptionSourceType | string;
  modelId: string;
  language?: string | null;
  translated: boolean;
  rawText: string;
  cleanedText: string;
  cleanupStrategy: string;
  durationMs?: number | null;
  audioPath?: string | null;
  pinned: boolean;
  deletedAt?: string | null;
};

export type SaveTranscriptionInput = {
  id?: string;
  createdAt?: string;
  sourceType: TranscriptionSourceType;
  modelId: string;
  language?: string | null;
  translated?: boolean;
  rawText: string;
  cleanedText: string;
  cleanupStrategy: string;
  durationMs?: number | null;
  audioPath?: string | null;
  pinned?: boolean;
};

export type ListTranscriptionsInput = {
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
  pinnedOnly?: boolean;
  query?: string;
};

export type UpdateTranscriptionInput = Partial<
  Pick<
    TranscriptionRecord,
    | "modelId"
    | "language"
    | "translated"
    | "rawText"
    | "cleanedText"
    | "cleanupStrategy"
    | "durationMs"
    | "audioPath"
    | "pinned"
    | "sourceType"
  >
>;

export type ImportTranscriptionsReport = {
  imported: number;
  skipped: number;
  failed: number;
  errors: string[];
};

export type TranscriptionHistoryStats = {
  totalCount: number;
  pinnedCount: number;
  deletedCount: number;
  avgDurationMs?: number | null;
};

export type ExportBundleZipResult = {
  bytes: number[];
  totalEntries: number;
  audioReferenced: number;
  audioIncluded: number;
  audioMissing: number;
};
