import type { AppSettings } from "@/lib/types/settings";

type SettingsUpdater<T> = (value: T) => (prev: AppSettings) => AppSettings;

function updateSetting<K extends keyof AppSettings>(key: K): SettingsUpdater<AppSettings[K]> {
  return (value) => (prev) => ({ ...prev, [key]: value });
}

export const updateDefaultModelId = updateSetting("defaultModelId");
export const updateLanguage = updateSetting("language");
export const updateTranslate = updateSetting("translate");
export const updateAutoCopy = updateSetting("autoCopy");
export const updateStartAtLogin = updateSetting("startAtLogin");
export const updateCleanupEnabled = updateSetting("cleanupEnabled");
export const updateLiveCleanupEnabled = updateSetting("liveCleanupEnabled");
export const updateLiveCleanupMode = updateSetting("liveCleanupMode");
export const updateFinalizeCleanupMode = updateSetting("finalizeCleanupMode");
export const updateCleanupLatencyBudgetMs = updateSetting("cleanupLatencyBudgetMs");
export const updateCleanupShowRawToggle = updateSetting("cleanupShowRawToggle");
export const updateCleanupBackend = updateSetting("cleanupBackend");
export const updateHistoryRetentionIncludePinned = updateSetting("historyRetentionIncludePinned");
export const updateHistoryRetentionDays: SettingsUpdater<number | null> = (value) => (prev) => ({
  ...prev,
  historyRetentionDays: value,
});
export const updateCleanupModelId: SettingsUpdater<string> = (value) => (prev) => ({
  ...prev,
  cleanupModelId: value || null,
});
export const updateAudioInputDeviceId: SettingsUpdater<string> = (value) => (prev) => ({
  ...prev,
  audioInputDeviceId: value || null,
});
