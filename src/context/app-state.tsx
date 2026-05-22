import { createContext, useContext, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { listen } from "@tauri-apps/api/event";
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
import { getErrorMessage, toastError, toastSuccess } from "@/lib/toast";
import type { CleanupStrategy } from "@/features/transcription/cleanup/types";
import { shouldApplyAutoPaste } from "@/context/lib/auto-paste-guard";

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [installed, setInstalled] = useState<InstalledModel[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    defaultModelId: "small",
    language: "auto",
    translate: false,
    autoCopy: false,
    autoPaste: true,
    startAtLogin: false,
    liveMode: true,
    audioInputDeviceId: null,
    cleanupEnabled: true,
    liveCleanupEnabled: true,
    liveCleanupMode: "rules",
    finalizeCleanupMode: "rules",
    cleanupLatencyBudgetMs: 200,
    cleanupShowRawToggle: false,
    cleanupBackend: "rules_only",
    cleanupModelId: null,
    historyRetentionDays: null,
    historyRetentionIncludePinned: false,
    overlayShortcut: "CmdOrCtrl+Shift+Space",
    overlayPinned: true,
    overlayHideStopsRecording: true,
    overlayEnabled: true,
  });
  const [transcript, setTranscript] = useState("");
  const [rawTranscript, setRawTranscript] = useState("");
  const [cleanupStrategy, setCleanupStrategy] = useState<CleanupStrategy>("raw");
  const [status, setStatus] = useState("idle");
  const [appDataDir, setAppDataDir] = useState("");
  const [settingsFilePath, setSettingsFilePath] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [activeTranscriptionTaskId, setActiveTranscriptionTaskId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Map<string, DownloadProgressEvent>>(new Map());
  const [backendAudioInputs, setBackendAudioInputs] = useState<AudioInputDevice[]>([]);
  const [browserAudioInputs, setBrowserAudioInputs] = useState<Array<{ id: string; label: string }>>([]);

  const settingsRef = useRef(settings);
  const autoCopyEnabledRef = useRef(settings.autoCopy);
  const autoPasteEnabledRef = useRef(settings.autoPaste);
  const appliedAutoPasteCompletionIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    settingsRef.current = settings;
    autoCopyEnabledRef.current = settings.autoCopy;
    autoPasteEnabledRef.current = settings.autoPaste;
  }, [settings]);

  const installedById = useMemo(() => new Map(installed.map((model) => [model.id, model])), [installed]);

  async function copyText(text: string) {
    if (isTauriRuntime) {
      await writeText(text);
      return;
    }
    await navigator.clipboard.writeText(text);
  }

  async function autoPasteText(text: string, completionId?: string) {
    const next = text.trim();
    if (!next) return;
    if (completionId && !shouldApplyAutoPaste(appliedAutoPasteCompletionIdsRef.current, completionId)) return;
    try {
      if (isTauriRuntime) {
        await api.pasteText(next);
      } else {
        await copyText(next);
      }
    } catch {
      await copyText(next);
      toastSuccess("Copied transcript", "Auto-paste was unavailable, so text was copied.");
    }
  }

  async function finalizeCompletionOutput(text: string, completionId: string) {
    const next = text.trim();
    if (!next) return;
    if (autoCopyEnabledRef.current) {
      await copyText(next);
    }
    if (!autoPasteEnabledRef.current) return;
    await autoPasteText(next, completionId);
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
      liveMode: settings.liveMode,
      setIsRecording,
      setStatus,
      setTranscript,
      setRawTranscript,
      setCleanupStrategy,
      setActiveTranscriptionTaskId,
      finalizeCompletionOutput,
      refreshBrowserAudioInputs,
    });

  useAppBootstrap({
    setModels,
    setInstalled,
    setSettings,
    setAppDataDir,
    setSettingsFilePath,
    setBackendAudioInputs,
    setDownloadProgress,
    setActiveTranscriptionTaskId,
    setStatus,
    setTranscript,
    setRawTranscript,
    setCleanupStrategy,
    refreshBrowserAudioInputs,
    finalizeCompletionOutput,
    settingsRef,
    teardownRecordingResources,
  });

  useEffect(() => {
    if (!isTauriRuntime) return;
    let active = true;
    const unlistenPromises = [
      listen("tray-start-recording", () => {
        if (!active || isRecording) return;
        void startRecording().catch((error) => toastError(error, "Recording failed"));
      }),
      listen("tray-stop-recording", () => {
        if (!active || !isRecording) return;
        void stopRecordingAndTranscribe().catch((error) => toastError(error, "Recording failed"));
      }),
    ];
    return () => {
      active = false;
      unlistenPromises.forEach((promise) => {
        void promise.then((unlisten) => unlisten());
      });
    };
  }, [isRecording, startRecording, stopRecordingAndTranscribe]);

  async function saveSettings() {
    try {
      await api.setOverlayShortcut(settings.overlayShortcut);
      await Promise.all([
        api.setStartAtLogin(settings.startAtLogin),
        api.setOverlayPinned(settings.overlayPinned),
        api.setOverlayEnabled(settings.overlayEnabled),
      ]);
      await api.saveSettings(settings);
      setStatus("settings saved");
      toastSuccess("Settings saved");
    } catch (error) {
      setStatus(getErrorMessage(error, "Failed to save settings"));
      toastError(error, "Failed to save settings");
      throw error;
    }
  }

  async function downloadModel(modelId: string) {
    try {
      await api.downloadModel(modelId);
      setStatus(`download started: ${modelId}`);
    } catch (error) {
      setStatus(getErrorMessage(error, `Failed to start download for ${modelId}`));
      toastError(error, `Failed to start download for ${modelId}`);
      throw error;
    }
  }

  async function deleteModel(modelId: string) {
    try {
      await api.deleteModel(modelId);
      setInstalled(await api.getInstalledModels());
      setStatus(`removed model: ${modelId}`);
      toastSuccess("Model removed", modelId);
    } catch (error) {
      setStatus(getErrorMessage(error, `Failed to remove model ${modelId}`));
      toastError(error, `Failed to remove model ${modelId}`);
      throw error;
    }
  }

  async function cancelTranscription(taskId: string) {
    try {
      await api.cancelTranscription(taskId);
      setStatus("cancel requested");
      toastSuccess("Cancel requested");
    } catch (error) {
      setStatus(getErrorMessage(error, "Failed to cancel transcription"));
      toastError(error, "Failed to cancel transcription");
      throw error;
    }
  }

  const setLiveMode = (value: SetStateAction<boolean>) => {
    setSettings((prev) => {
      const nextLiveMode = typeof value === "function" ? value(prev.liveMode) : value;
      const nextSettings = { ...prev, liveMode: nextLiveMode };
      void api.saveSettings(nextSettings).catch(() => undefined);
      return nextSettings;
    });
  };

  const value: AppStateValue = {
    models,
    installed,
    settings,
    transcript,
    rawTranscript,
    cleanupStrategy,
    status,
    appDataDir,
    settingsFilePath,
    isRecording,
    liveMode: settings.liveMode,
    activeTranscriptionTaskId,
    downloadProgress,
    backendAudioInputs,
    browserAudioInputs,
    installedById,
    setSettings,
    setTranscript,
    setRawTranscript,
    setCleanupStrategy,
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
