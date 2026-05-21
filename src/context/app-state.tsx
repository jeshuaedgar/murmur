import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { api } from "@/lib/api/tauri";
import type { AppSettings } from "@/lib/types/settings";
import type {
  AudioInputDevice,
  DownloadProgressEvent,
  InstalledModel,
  ModelInfo,
} from "@/lib/types/models";
import { isTauriRuntime } from "@/lib/runtime/tauri";
import { useAppBootstrap } from "@/context/hooks/use-app-bootstrap";
import { useBrowserAudioInputs } from "@/context/hooks/use-browser-audio-inputs";
import { useTranscriptionActions } from "@/context/hooks/use-transcription-actions";
import type { AppStateValue } from "@/context/types/app-state";

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [installed, setInstalled] = useState<InstalledModel[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    defaultModelId: "small",
    language: "auto",
    translate: false,
    autoCopy: false,
    audioInputDeviceId: null,
  });
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("idle");
  const [appDataDir, setAppDataDir] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [liveMode, setLiveMode] = useState(true);
  const [activeTranscriptionTaskId, setActiveTranscriptionTaskId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Map<string, DownloadProgressEvent>>(new Map());
  const [backendAudioInputs, setBackendAudioInputs] = useState<AudioInputDevice[]>([]);
  const [browserAudioInputs, setBrowserAudioInputs] = useState<Array<{ id: string; label: string }>>([]);

  const settingsRef = useRef(settings);
  const autoCopyEnabledRef = useRef(settings.autoCopy);

  useEffect(() => {
    settingsRef.current = settings;
    autoCopyEnabledRef.current = settings.autoCopy;
  }, [settings]);

  const installedById = useMemo(() => new Map(installed.map((model) => [model.id, model])), [installed]);

  async function copyText(text: string) {
    if (isTauriRuntime) {
      await writeText(text);
      return;
    }
    await navigator.clipboard.writeText(text);
  }

  const { refreshBrowserAudioInputs } = useBrowserAudioInputs({
    setBrowserAudioInputs,
    settingsRef,
    setSettings,
  });

  const { startRecording, stopRecordingAndTranscribe, startFileTranscription, teardownRecordingResources } =
    useTranscriptionActions({
      settings,
      settingsRef,
      appDataDir,
      isRecording,
      liveMode,
      setIsRecording,
      setStatus,
      setTranscript,
      setActiveTranscriptionTaskId,
      copyText,
      refreshBrowserAudioInputs,
    });

  useAppBootstrap({
    setModels,
    setInstalled,
    setSettings,
    setAppDataDir,
    setBackendAudioInputs,
    setDownloadProgress,
    setActiveTranscriptionTaskId,
    setStatus,
    setTranscript,
    refreshBrowserAudioInputs,
    copyText,
    autoCopyEnabledRef,
    teardownRecordingResources,
  });

  async function saveSettings() {
    await api.saveSettings(settings);
    setStatus("settings saved");
  }

  async function downloadModel(modelId: string) {
    await api.downloadModel(modelId);
  }

  async function deleteModel(modelId: string) {
    await api.deleteModel(modelId);
    setInstalled(await api.getInstalledModels());
  }

  async function cancelTranscription(taskId: string) {
    await api.cancelTranscription(taskId);
    setStatus("cancel requested");
  }

  const value: AppStateValue = {
    models,
    installed,
    settings,
    transcript,
    status,
    appDataDir,
    isRecording,
    liveMode,
    activeTranscriptionTaskId,
    downloadProgress,
    backendAudioInputs,
    browserAudioInputs,
    installedById,
    setSettings,
    setTranscript,
    setLiveMode,
    setStatus,
    startRecording,
    stopRecordingAndTranscribe,
    startFileTranscription,
    saveSettings,
    copyText,
    downloadModel,
    deleteModel,
    cancelTranscription,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}
