import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../types/settings";
import type {
  AudioInputDevice,
  ConnectivityStatus,
  DownloadTaskInfo,
  InstalledModel,
  ModelCatalogCacheDiagnostics,
  ModelInfo,
} from "../types/models";
import type {
  CleanupTextOptions,
  CleanupTextResult,
  TranscriptionOptions,
  TranscriptionResult,
} from "../types/transcription";
import type {
  ListTranscriptionsInput,
  ImportTranscriptionsReport,
  SaveTranscriptionInput,
  ExportBundleZipResult,
  TranscriptionHistoryStats,
  TranscriptionRecord,
  UpdateTranscriptionInput,
} from "../types/history";

export const api = {
  listModels: () => invoke<ModelInfo[]>("list_models"),
  getInstalledModels: () => invoke<InstalledModel[]>("get_installed_models"),
  downloadModel: (modelId: string) =>
    invoke<DownloadTaskInfo>("download_model", { modelId }),
  checkHuggingFaceConnectivity: () =>
    invoke<ConnectivityStatus>("check_huggingface_connectivity"),
  invalidateModelCatalogCache: () => invoke<void>("invalidate_model_catalog_cache"),
  getModelCatalogCacheDiagnostics: () =>
    invoke<ModelCatalogCacheDiagnostics>("get_model_catalog_cache_diagnostics"),
  cancelDownload: (taskId: string) => invoke<void>("cancel_download", { taskId }),
  deleteModel: (modelId: string) => invoke<void>("delete_model", { modelId }),
  getSettings: () => invoke<AppSettings>("get_settings"),
  saveSettings: (settings: AppSettings) => invoke<void>("save_settings", { settings }),
  isStartAtLoginEnabled: () => invoke<boolean>("is_start_at_login_enabled"),
  setStartAtLogin: (enabled: boolean) => invoke<void>("set_start_at_login", { enabled }),
  toggleOverlay: () => invoke<void>("toggle_overlay"),
  showOverlay: () => invoke<void>("show_overlay"),
  hideOverlay: () => invoke<void>("hide_overlay"),
  setOverlayShortcut: (shortcut: string) =>
    invoke<void>("set_overlay_shortcut", { shortcut }),
  setOverlayPinned: (pinned: boolean) =>
    invoke<void>("set_overlay_pinned", { pinned }),
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
  cleanupText: (text: string, options: CleanupTextOptions) =>
    invoke<CleanupTextResult>("cleanup_text", { text, options }),
  getAppDataDir: () => invoke<string>("get_app_data_dir"),
  getSettingsFilePath: () => invoke<string>("get_settings_file_path"),
  getAudioInputs: () => invoke<AudioInputDevice[]>("get_audio_inputs"),
  saveTranscription: (entry: SaveTranscriptionInput) =>
    invoke<TranscriptionRecord>("save_transcription", { entry }),
  listTranscriptions: (params?: ListTranscriptionsInput) =>
    invoke<TranscriptionRecord[]>("list_transcriptions", { params }),
  getTranscription: (id: string) =>
    invoke<TranscriptionRecord>("get_transcription", { id }),
  updateTranscription: (id: string, patch: UpdateTranscriptionInput) =>
    invoke<TranscriptionRecord>("update_transcription", { id, patch }),
  deleteTranscription: (id: string, hard = false) =>
    invoke<void>("delete_transcription", { id, hard }),
  restoreTranscription: (id: string) =>
    invoke<void>("restore_transcription", { id }),
  exportTranscriptions: (includeDeleted = true) =>
    invoke<string>("export_transcriptions", { includeDeleted }),
  exportTranscriptionsCsv: (includeDeleted = true) =>
    invoke<string>("export_transcriptions_csv", { includeDeleted }),
  exportTranscriptionsBundleZip: (includeDeleted = true) =>
    invoke<ExportBundleZipResult>("export_transcriptions_bundle_zip", { includeDeleted }),
  importTranscriptions: (payload: string) =>
    invoke<ImportTranscriptionsReport>("import_transcriptions", { payload }),
  getTranscriptionHistoryStats: () =>
    invoke<TranscriptionHistoryStats>("get_transcription_history_stats"),
  applyHistoryRetention: (days: number, includePinned = false) =>
    invoke<number>("apply_history_retention", { days, includePinned }),
};
