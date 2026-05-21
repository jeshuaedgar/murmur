import { useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { listen } from "@tauri-apps/api/event";
import { api } from "@/lib/api/tauri";
import type { AppSettings } from "@/lib/types/settings";
import type {
  AudioInputDevice,
  DownloadProgressEvent,
  InstalledModel,
  ModelInfo,
} from "@/lib/types/models";
import type { TranscriptionResult } from "@/lib/types/transcription";
import { isTauriRuntime } from "@/lib/runtime/tauri";
import {
  getErrorMessage,
  toastError,
  toastModelDownloadComplete,
  toastModelDownloadFailed,
  toastModelDownloadProgress,
  toastSuccess,
} from "@/lib/toast";

type UseAppBootstrapParams = {
  setModels: Dispatch<SetStateAction<ModelInfo[]>>;
  setInstalled: Dispatch<SetStateAction<InstalledModel[]>>;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  setAppDataDir: Dispatch<SetStateAction<string>>;
  setBackendAudioInputs: Dispatch<SetStateAction<AudioInputDevice[]>>;
  setDownloadProgress: Dispatch<SetStateAction<Map<string, DownloadProgressEvent>>>;
  setActiveTranscriptionTaskId: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setTranscript: Dispatch<SetStateAction<string>>;
  refreshBrowserAudioInputs: () => Promise<void>;
  copyText: (text: string) => Promise<void>;
  autoCopyEnabledRef: MutableRefObject<boolean>;
  teardownRecordingResources: () => void;
};

export function useAppBootstrap({
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
}: UseAppBootstrapParams) {
  const didInitRef = useRef(false);
  const lastStartupErrorRef = useRef<string | null>(null);
  const downloadProgressFlushTimerRef = useRef<number | null>(null);
  const pendingDownloadProgressRef = useRef<Map<string, DownloadProgressEvent>>(new Map());

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    let mounted = true;
    const cleanup: Array<() => void> = [];

    const init = async () => {
      if (!isTauriRuntime) {
        if (!mounted) return;
        setStatus("web preview mode");
        setModels([]);
        setInstalled([]);
        setAppDataDir("(Tauri runtime unavailable in plain Vite dev mode)");
        setBackendAudioInputs([]);
        await refreshBrowserAudioInputs();
        return;
      }

      const [allModels, allInstalled, appSettings, dataDir, audioInputs] = await Promise.all([
        api.listModels(),
        api.getInstalledModels(),
        api.getSettings(),
        api.getAppDataDir(),
        api.getAudioInputs(),
      ]);

      if (!mounted) return;
      setModels(allModels);
      setInstalled(allInstalled);
      const defaultInstalled = allInstalled.some(
        (model) => model.id === appSettings.defaultModelId && model.installed,
      );
      const fallbackInstalled = allInstalled.find((model) => model.installed);
      const shouldSwitchDefault = !defaultInstalled && Boolean(fallbackInstalled);
      const nextSettings = shouldSwitchDefault
        ? { ...appSettings, defaultModelId: fallbackInstalled!.id }
        : appSettings;
      setSettings(nextSettings);
      setAppDataDir(dataDir);
      setBackendAudioInputs(audioInputs);

      if (shouldSwitchDefault) {
        setStatus(`Default model switched to ${fallbackInstalled!.id}.`);
        toastSuccess("Default model updated", `Using installed model: ${fallbackInstalled!.id}`);
        try {
          await api.saveSettings(nextSettings);
        } catch (error) {
          setStatus(getErrorMessage(error, "Could not save updated model preference"));
          toastError(error, "Could not save updated model preference");
        }
      } else if (!defaultInstalled) {
        setStatus("No local model is installed. Open Models to install one.");
      }

      if ("mediaDevices" in navigator && typeof navigator.mediaDevices?.getUserMedia === "function") {
        try {
          const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          permissionStream.getTracks().forEach((track) => track.stop());
        } catch {
          // ignore permissions errors at bootstrap
        }
      }

      await refreshBrowserAudioInputs();

      cleanup.push(
        await listen<DownloadProgressEvent>("model-download-progress", (event) => {
          pendingDownloadProgressRef.current.set(event.payload.taskId, event.payload);
          if (downloadProgressFlushTimerRef.current !== null) {
            return;
          }
          downloadProgressFlushTimerRef.current = window.setTimeout(() => {
            downloadProgressFlushTimerRef.current = null;
            setDownloadProgress((prev) => {
              const next = new Map(prev);
              for (const pendingEvent of pendingDownloadProgressRef.current.values()) {
                const previous = next.get(pendingEvent.taskId);
                const inferredPct =
                  typeof pendingEvent.totalBytes === "number" && pendingEvent.totalBytes > 0
                    ? (pendingEvent.downloadedBytes / pendingEvent.totalBytes) * 100
                    : undefined;
                const incomingPct =
                  typeof pendingEvent.progressPct === "number" ? pendingEvent.progressPct : inferredPct;
                const previousPct = previous?.progressPct;
                const normalizedPct =
                  typeof incomingPct === "number"
                    ? Math.max(0, Math.min(100, Math.max(previousPct ?? 0, incomingPct)))
                    : previousPct;
                next.set(pendingEvent.taskId, {
                  ...pendingEvent,
                  progressPct: normalizedPct,
                });
                toastModelDownloadProgress(pendingEvent.taskId, pendingEvent.modelId, normalizedPct);
              }
              pendingDownloadProgressRef.current.clear();
              return next;
            });
          }, 200);
        }),
      );

      cleanup.push(
        await listen<{ taskId: string; modelId: string }>("model-download-complete", async (event) => {
          setDownloadProgress((prev) => {
            const next = new Map(prev);
            next.delete(event.payload.taskId);
            return next;
          });
          setInstalled(await api.getInstalledModels());
          setStatus(`model ${event.payload.modelId} installed`);
          toastModelDownloadComplete(event.payload.taskId, event.payload.modelId);
        }),
      );

      cleanup.push(
        await listen<{ taskId: string; modelId: string; error: string }>("model-download-error", (event) => {
          setDownloadProgress((prev) => {
            const next = new Map(prev);
            next.delete(event.payload.taskId);
            return next;
          });
          setStatus(`Download failed for ${event.payload.modelId}. ${getErrorMessage(event.payload.error, "Please try again.")}`);
          toastModelDownloadFailed(
            event.payload.taskId,
            event.payload.error,
            `Download failed for ${event.payload.modelId}`,
          );
        }),
      );

      cleanup.push(
        await listen<{ taskId: string; stage: string; message: string }>("transcription-progress", (event) => {
          setActiveTranscriptionTaskId((current) => {
            if (current === event.payload.taskId) {
              setStatus(`${event.payload.stage}: ${event.payload.message}`);
            }
            return current;
          });
        }),
      );

      cleanup.push(
        await listen<{ taskId: string; result: TranscriptionResult }>("transcription-complete", (event) => {
          setActiveTranscriptionTaskId((current) => {
            if (current !== event.payload.taskId) return current;
            const nextText = event.payload.result.text;
            setTranscript(nextText);
            if (autoCopyEnabledRef.current && nextText) {
              void copyText(nextText);
            }
            setStatus("done");
            toastSuccess("Transcription complete");
            return null;
          });
        }),
      );

      cleanup.push(
        await listen<{ taskId: string; error: string }>("transcription-error", (event) => {
          setActiveTranscriptionTaskId((current) => {
            if (current !== event.payload.taskId) return current;
            setStatus(getErrorMessage(event.payload.error, "Transcription failed"));
            toastError(event.payload.error, "Transcription failed");
            return null;
          });
        }),
      );

      cleanup.push(
        await listen<{ taskId: string }>("transcription-canceled", (event) => {
          setActiveTranscriptionTaskId((current) => {
            if (current !== event.payload.taskId) return current;
            setStatus("transcription canceled");
            toastSuccess("Transcription canceled");
            return null;
          });
        }),
      );
    };

    void init().catch((err) => {
      if (mounted) {
        const message = `App startup failed. ${getErrorMessage(err, "Please restart the app.")}`;
        setStatus(message);
        if (lastStartupErrorRef.current !== message) {
          toastError(err, "App bootstrap failed");
          lastStartupErrorRef.current = message;
        }
      }
    });

    return () => {
      didInitRef.current = false;
      mounted = false;
      if (downloadProgressFlushTimerRef.current !== null) {
        window.clearTimeout(downloadProgressFlushTimerRef.current);
      }
      downloadProgressFlushTimerRef.current = null;
      pendingDownloadProgressRef.current.clear();
      cleanup.forEach((unsub) => unsub());
      teardownRecordingResources();
    };
  }, []);
}
