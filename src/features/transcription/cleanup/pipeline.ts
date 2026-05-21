import { api } from "@/lib/api/tauri";
import type { AppSettings } from "@/lib/types/settings";
import { applyCleanupRules } from "@/features/transcription/cleanup/rules";
import type { CleanupResult } from "@/features/transcription/cleanup/types";

export async function runCleanupPipeline(
  rawText: string,
  settings: AppSettings,
  language: string | null | undefined,
): Promise<CleanupResult> {
  if (!settings.cleanupEnabled) {
    return { raw: rawText, cleaned: rawText, strategy: "raw" };
  }

  const rulesCleaned = applyCleanupRules(rawText);

  if (settings.finalizeCleanupMode === "off") {
    return { raw: rawText, cleaned: rawText, strategy: "raw" };
  }

  if (settings.finalizeCleanupMode === "rules" || settings.cleanupBackend === "rules_only") {
    return { raw: rawText, cleaned: rulesCleaned, strategy: "rules" };
  }

  try {
    const modelResult = await api.cleanupText(rawText, {
      language: language ?? null,
      mode: settings.finalizeCleanupMode,
      timeoutMs: settings.cleanupLatencyBudgetMs,
    });
    return {
      raw: rawText,
      cleaned: modelResult.cleanedText,
      strategy: modelResult.strategy,
      rejectedReason: modelResult.rejectedReason ?? undefined,
    };
  } catch {
    return {
      raw: rawText,
      cleaned: rulesCleaned,
      strategy: "rules",
      rejectedReason: "backend_cleanup_failed",
    };
  }
}

export function runLiveCleanup(rawText: string, settings: AppSettings): CleanupResult {
  if (!settings.cleanupEnabled || !settings.liveCleanupEnabled || settings.liveCleanupMode === "off") {
    return { raw: rawText, cleaned: rawText, strategy: "raw" };
  }

  return {
    raw: rawText,
    cleaned: applyCleanupRules(rawText),
    strategy: "rules",
  };
}
