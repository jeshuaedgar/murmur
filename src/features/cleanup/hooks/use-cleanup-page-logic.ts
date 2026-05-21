import { useMemo } from "react";
import type { AppSettings } from "@/lib/types/settings";
import type { InstalledModel, ModelInfo } from "@/lib/types/models";
import {
  updateCleanupBackend,
  updateCleanupEnabled,
  updateCleanupLatencyBudgetMs,
  updateCleanupModelId,
  updateCleanupShowRawToggle,
  updateFinalizeCleanupMode,
  updateLiveCleanupEnabled,
  updateLiveCleanupMode,
} from "@/features/settings/lib/settings-updaters";

export function useCleanupPageLogic({
  settings,
  models,
  installedById,
  setSettings,
}: {
  settings: AppSettings;
  models: ModelInfo[];
  installedById: Map<string, InstalledModel>;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
}) {
  const installedModelOptions = useMemo(
    () =>
      models.filter(
        (model) => model.lab === "Cleanup Models" && installedById.get(model.id)?.installed,
      ),
    [installedById, models],
  );

  const installedCount = installedModelOptions.length;

  const cleanupRulesPreview = [
    "Remove filler tokens: um, uh, er, ah, you know, I mean",
    "Collapse repeated adjacent words",
    "Normalize whitespace and duplicate punctuation",
    "Trim spacing before punctuation",
  ];

  return {
    installedModelOptions,
    installedCount,
    cleanupRulesPreview,
    onCleanupEnabledChange: (checked: boolean) => setSettings(updateCleanupEnabled(checked)),
    onLiveCleanupEnabledChange: (checked: boolean) => setSettings(updateLiveCleanupEnabled(checked)),
    onLiveCleanupModeChange: (value: "off" | "rules") => setSettings(updateLiveCleanupMode(value)),
    onFinalizeCleanupModeChange: (value: "off" | "rules" | "rules_plus_model") =>
      setSettings(updateFinalizeCleanupMode(value)),
    onCleanupLatencyBudgetMsChange: (value: string) =>
      setSettings(updateCleanupLatencyBudgetMs(Math.max(50, Number(value) || 200))),
    onCleanupShowRawToggleChange: (checked: boolean) => setSettings(updateCleanupShowRawToggle(checked)),
    onCleanupBackendChange: (value: "rules_only" | "local_model") => setSettings(updateCleanupBackend(value)),
    onCleanupModelIdChange: (value: string) => setSettings(updateCleanupModelId(value)),
  };
}
