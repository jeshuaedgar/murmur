export type CleanupStrategy = "raw" | "rules" | "rules_plus_model";

export type CleanupResult = {
  raw: string;
  cleaned: string;
  strategy: CleanupStrategy;
  rejectedReason?: string;
};
