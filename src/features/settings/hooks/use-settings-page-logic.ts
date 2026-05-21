import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import type { AppSettings } from "@/lib/types/settings";
import type { ModelInfo } from "@/lib/types/models";
import {
  updateAudioInputDeviceId,
  updateAutoCopy,
  updateDefaultModelId,
  updateLanguage,
  updateTranslate,
} from "@/features/settings/lib/settings-updaters";

type UseSettingsPageLogicArgs = {
  models: ModelInfo[];
  browserAudioInputs: Array<{ id: string; label: string }>;
  backendAudioInputs: Array<{ id: string; label: string }>;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  saveSettings: () => Promise<void>;
};

export function useSettingsPageLogic({
  models,
  browserAudioInputs,
  backendAudioInputs,
  setSettings,
  saveSettings,
}: UseSettingsPageLogicArgs) {
  const modelOptions = useMemo(
    () => models.map((model) => ({ id: model.id, name: model.name })),
    [models],
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
  const onSaveSettings = useCallback(async () => {
    await saveSettings().catch(() => undefined);
  }, [saveSettings]);

  return {
    modelOptions,
    browserInputOptions,
    audioInputsSummary,
    onDefaultModelChange,
    onLanguageChange,
    onAudioInputChange,
    onTranslateChange,
    onAutoCopyChange,
    onSaveSettings,
  };
}
