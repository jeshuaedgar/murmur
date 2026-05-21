import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import type { AppSettings } from "@/lib/types/settings";
import type { InstalledModel, ModelInfo } from "@/lib/types/models";
import { compareLabs } from "@/features/models/lib/lab-order";
import {
  updateAudioInputDeviceId,
  updateAutoCopy,
  updateCleanupEnabled,
  updateCleanupLatencyBudgetMs,
  updateCleanupShowRawToggle,
  updateDefaultModelId,
  updateFinalizeCleanupMode,
  updateLanguage,
  updateLiveCleanupEnabled,
  updateLiveCleanupMode,
  updateOverlayHideStopsRecording,
  updateOverlayEnabled,
  updateOverlayPinned,
  updateOverlayShortcut,
  updateHistoryRetentionDays,
  updateHistoryRetentionIncludePinned,
  updateStartAtLogin,
  updateTranslate,
} from "@/features/settings/lib/settings-updaters";

type UseSettingsPageLogicArgs = {
  models: ModelInfo[];
  installedById: Map<string, InstalledModel>;
  browserAudioInputs: Array<{ id: string; label: string }>;
  backendAudioInputs: Array<{ id: string; label: string }>;
  defaultModelId: string;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  saveSettings: () => Promise<void>;
};

export type ModelOption = {
  id: string;
  name: string;
  lab: string;
  disabled: boolean;
  statusLabel: "Installed" | "Not installed";
};

export type ModelOptionGroup = {
  lab: string;
  options: ModelOption[];
};

export function buildModelOptionsByLab(
  models: ModelInfo[],
  installedById: Map<string, InstalledModel>,
): ModelOptionGroup[] {
  const grouped = new Map<string, ModelOption[]>();

  for (const model of models) {
    const installed = Boolean(installedById.get(model.id)?.installed);
    const current = grouped.get(model.lab) ?? [];
    current.push({
      id: model.id,
      name: model.name,
      lab: model.lab,
      disabled: !installed,
      statusLabel: installed ? "Installed" : "Not installed",
    });
    grouped.set(model.lab, current);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => compareLabs(a, b))
    .map(([lab, options]) => ({ lab, options }));
}

export function resolveInstalledDefaultModelId(
  defaultModelId: string,
  models: ModelInfo[],
  installedById: Map<string, InstalledModel>,
): string | null {
  if (installedById.get(defaultModelId)?.installed) {
    return defaultModelId;
  }

  const fallback = models.find((model) => installedById.get(model.id)?.installed);
  return fallback?.id ?? null;
}

export function useSettingsPageLogic({
  models,
  installedById,
  browserAudioInputs,
  backendAudioInputs,
  defaultModelId,
  setSettings,
  saveSettings,
}: UseSettingsPageLogicArgs) {
  const modelOptionsByLab = useMemo(
    () => buildModelOptionsByLab(models, installedById),
    [installedById, models],
  );

  const resolvedDefaultModelId = useMemo(
    () => resolveInstalledDefaultModelId(defaultModelId, models, installedById),
    [defaultModelId, installedById, models],
  );

  const browserInputOptions = useMemo(
    () => browserAudioInputs.map((device) => ({ id: device.id, label: device.label })),
    [browserAudioInputs],
  );

  const audioInputsSummary = useMemo(
    () => `Detected by browser: ${browserAudioInputs.length} • Detected by backend: ${backendAudioInputs.length}`,
    [backendAudioInputs.length, browserAudioInputs.length],
  );

  const onDefaultModelChange = useCallback(
    (value: string) => setSettings(updateDefaultModelId(value)),
    [setSettings],
  );
  const onLanguageChange = useCallback(
    (value: string) => setSettings(updateLanguage(value)),
    [setSettings],
  );
  const onAudioInputChange = useCallback(
    (value: string) => setSettings(updateAudioInputDeviceId(value)),
    [setSettings],
  );
  const onTranslateChange = useCallback(
    (checked: boolean) => setSettings(updateTranslate(checked)),
    [setSettings],
  );
  const onAutoCopyChange = useCallback(
    (checked: boolean) => setSettings(updateAutoCopy(checked)),
    [setSettings],
  );
  const onStartAtLoginChange = useCallback(
    (checked: boolean) => setSettings(updateStartAtLogin(checked)),
    [setSettings],
  );
  const onCleanupEnabledChange = useCallback(
    (checked: boolean) => setSettings(updateCleanupEnabled(checked)),
    [setSettings],
  );
  const onLiveCleanupEnabledChange = useCallback(
    (checked: boolean) => setSettings(updateLiveCleanupEnabled(checked)),
    [setSettings],
  );
  const onLiveCleanupModeChange = useCallback(
    (value: "off" | "rules") => setSettings(updateLiveCleanupMode(value)),
    [setSettings],
  );
  const onFinalizeCleanupModeChange = useCallback(
    (value: "off" | "rules" | "rules_plus_model") => setSettings(updateFinalizeCleanupMode(value)),
    [setSettings],
  );
  const onCleanupLatencyBudgetMsChange = useCallback(
    (value: string) => setSettings(updateCleanupLatencyBudgetMs(Number(value) || 200)),
    [setSettings],
  );
  const onCleanupShowRawToggleChange = useCallback(
    (checked: boolean) => setSettings(updateCleanupShowRawToggle(checked)),
    [setSettings],
  );
  const onSaveSettings = useCallback(async () => {
    await saveSettings();
  }, [saveSettings]);
  const onHistoryRetentionDaysChange = useCallback(
    (value: string) => setSettings(updateHistoryRetentionDays(value.trim() ? Number(value) || null : null)),
    [setSettings],
  );
  const onHistoryRetentionIncludePinnedChange = useCallback(
    (checked: boolean) => setSettings(updateHistoryRetentionIncludePinned(checked)),
    [setSettings],
  );
  const onOverlayShortcutChange = useCallback(
    (value: string) => setSettings(updateOverlayShortcut(value)),
    [setSettings],
  );
  const onOverlayPinnedChange = useCallback(
    (checked: boolean) => setSettings(updateOverlayPinned(checked)),
    [setSettings],
  );
  const onOverlayHideStopsRecordingChange = useCallback(
    (checked: boolean) => setSettings(updateOverlayHideStopsRecording(checked)),
    [setSettings],
  );
  const onOverlayEnabledChange = useCallback(
    (checked: boolean) => setSettings(updateOverlayEnabled(checked)),
    [setSettings],
  );

  return {
    modelOptionsByLab,
    resolvedDefaultModelId,
    browserInputOptions,
    audioInputsSummary,
    onDefaultModelChange,
    onLanguageChange,
    onAudioInputChange,
    onTranslateChange,
    onAutoCopyChange,
    onStartAtLoginChange,
    onCleanupEnabledChange,
    onLiveCleanupEnabledChange,
    onLiveCleanupModeChange,
    onFinalizeCleanupModeChange,
    onCleanupLatencyBudgetMsChange,
    onCleanupShowRawToggleChange,
    onHistoryRetentionDaysChange,
    onHistoryRetentionIncludePinnedChange,
    onOverlayShortcutChange,
    onOverlayPinnedChange,
    onOverlayHideStopsRecordingChange,
    onOverlayEnabledChange,
    onSaveSettings,
  };
}
