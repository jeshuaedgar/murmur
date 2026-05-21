import type { AppSettings } from "@/lib/types/settings";

type SettingsUpdater<T> = (value: T) => (prev: AppSettings) => AppSettings;

function updateSetting<K extends keyof AppSettings>(key: K): SettingsUpdater<AppSettings[K]> {
  return (value) => (prev) => ({ ...prev, [key]: value });
}

export const updateDefaultModelId = updateSetting("defaultModelId");
export const updateLanguage = updateSetting("language");
export const updateTranslate = updateSetting("translate");
export const updateAutoCopy = updateSetting("autoCopy");
export const updateAudioInputDeviceId: SettingsUpdater<string> = (value) => (prev) => ({
  ...prev,
  audioInputDeviceId: value || null,
});
