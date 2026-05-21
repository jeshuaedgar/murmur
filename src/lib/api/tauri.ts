import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../types/settings";
import type {
  AudioInputDevice,
  DownloadTaskInfo,
  InstalledModel,
  ModelInfo,
} from "../types/models";
import type { TranscriptionOptions, TranscriptionResult } from "../types/transcription";

export const api = {
  listModels: () => invoke<ModelInfo[]>("list_models"),
  getInstalledModels: () => invoke<InstalledModel[]>("get_installed_models"),
  downloadModel: (modelId: string) =>
    invoke<DownloadTaskInfo>("download_model", { modelId }),
  cancelDownload: (taskId: string) => invoke<void>("cancel_download", { taskId }),
  deleteModel: (modelId: string) => invoke<void>("delete_model", { modelId }),
  getSettings: () => invoke<AppSettings>("get_settings"),
  saveSettings: (settings: AppSettings) => invoke<void>("save_settings", { settings }),
  transcribeFile: (path: string, options: TranscriptionOptions) =>
    invoke<TranscriptionResult>("transcribe_file", { path, options }),
  transcribeRecording: (path: string, options: TranscriptionOptions) =>
    invoke<TranscriptionResult>("transcribe_recording", { path, options }),
  startTranscriptionFile: (path: string, options: TranscriptionOptions) =>
    invoke<{ taskId: string; status: string }>("start_transcription_file", {
      path,
      options,
    }),
  cancelTranscription: (taskId: string) =>
    invoke<void>("cancel_transcription", { taskId }),
  transcribePcm: (
    samples: number[],
    sampleRate: number,
    options: TranscriptionOptions,
  ) =>
    invoke<TranscriptionResult>("transcribe_pcm", {
      samples,
      sampleRate,
      options,
    }),
  getAppDataDir: () => invoke<string>("get_app_data_dir"),
  getAudioInputs: () => invoke<AudioInputDevice[]>("get_audio_inputs"),
};
