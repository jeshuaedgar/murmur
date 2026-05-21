import { useEffect } from "react";
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
  useEffect(() => {
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
      setSettings(appSettings);
      setAppDataDir(dataDir);
      setBackendAudioInputs(audioInputs);

      try {
        const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        permissionStream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore permissions errors at bootstrap
      }

      await refreshBrowserAudioInputs();

      cleanup.push(
        await listen<DownloadProgressEvent>("model-download-progress", (event) => {
          setDownloadProgress((prev) => {
            const next = new Map(prev);
            next.set(event.payload.taskId, event.payload);
            return next;
          });
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
        }),
      );

      cleanup.push(
        await listen<{ taskId: string; modelId: string; error: string }>("model-download-error", (event) => {
          setDownloadProgress((prev) => {
            const next = new Map(prev);
            next.delete(event.payload.taskId);
            return next;
          });
          setStatus(`download error (${event.payload.modelId}): ${event.payload.error}`);
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
            return null;
          });
        }),
      );

      cleanup.push(
        await listen<{ taskId: string; error: string }>("transcription-error", (event) => {
          setActiveTranscriptionTaskId((current) => {
            if (current !== event.payload.taskId) return current;
            setStatus(`transcription error: ${event.payload.error}`);
            return null;
          });
        }),
      );

      cleanup.push(
        await listen<{ taskId: string }>("transcription-canceled", (event) => {
          setActiveTranscriptionTaskId((current) => {
            if (current !== event.payload.taskId) return current;
            setStatus("transcription canceled");
            return null;
          });
        }),
      );
    };

    void init().catch((err) => {
      if (mounted) setStatus(`Bootstrap failed: ${String(err)}`);
    });

    return () => {
      mounted = false;
      cleanup.forEach((unsub) => unsub());
      teardownRecordingResources();
    };
  }, [
    autoCopyEnabledRef,
    copyText,
    refreshBrowserAudioInputs,
    setActiveTranscriptionTaskId,
    setAppDataDir,
    setBackendAudioInputs,
    setDownloadProgress,
    setInstalled,
    setModels,
    setSettings,
    setStatus,
    setTranscript,
    teardownRecordingResources,
  ]);
}
