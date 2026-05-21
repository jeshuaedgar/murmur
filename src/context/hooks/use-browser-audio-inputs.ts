import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { AppSettings } from "@/lib/types/settings";

type BrowserAudioInput = { id: string; label: string };

type UseBrowserAudioInputsParams = {
  setBrowserAudioInputs: Dispatch<SetStateAction<BrowserAudioInput[]>>;
  settingsRef: MutableRefObject<AppSettings>;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
};

export function useBrowserAudioInputs({
  setBrowserAudioInputs,
  settingsRef,
  setSettings,
}: UseBrowserAudioInputsParams) {
  const refreshBrowserAudioInputs = useCallback(async () => {
    if (!("mediaDevices" in navigator) || typeof navigator.mediaDevices?.enumerateDevices !== "function") {
      setBrowserAudioInputs([]);
      return;
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices
      .filter((device) => device.kind === "audioinput")
      .map((device) => ({ id: device.deviceId, label: device.label || "Microphone" }));

    setBrowserAudioInputs(inputs);
    if (!settingsRef.current.audioInputDeviceId && inputs.length > 0) {
      setSettings((prev) => ({ ...prev, audioInputDeviceId: inputs[0].id }));
    }
  }, [setBrowserAudioInputs, setSettings, settingsRef]);

  return { refreshBrowserAudioInputs };
}
