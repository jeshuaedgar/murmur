import type { Dispatch, SetStateAction } from "react";
import type { AppSettings } from "@/lib/types/settings";
import type { CleanupStrategy } from "@/features/transcription/cleanup/types";
import type {
  AudioInputDevice,
  DownloadProgressEvent,
  InstalledModel,
  ModelInfo,
} from "@/lib/types/models";

export type AppStateValue = {
  models: ModelInfo[];
  installed: InstalledModel[];
  settings: AppSettings;
  transcript: string;
  rawTranscript: string;
  cleanupStrategy: CleanupStrategy;
  status: string;
  appDataDir: string;
  settingsFilePath: string;
  isRecording: boolean;
  liveMode: boolean;
  activeTranscriptionTaskId: string | null;
  downloadProgress: Map<string, DownloadProgressEvent>;
  backendAudioInputs: AudioInputDevice[];
  browserAudioInputs: Array<{ id: string; label: string }>;
  installedById: Map<string, InstalledModel>;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  setTranscript: Dispatch<SetStateAction<string>>;
  setRawTranscript: Dispatch<SetStateAction<string>>;
  setCleanupStrategy: Dispatch<SetStateAction<CleanupStrategy>>;
  setLiveMode: Dispatch<SetStateAction<boolean>>;
  setStatus: Dispatch<SetStateAction<string>>;
  startRecording: () => Promise<void>;
  stopRecordingAndTranscribe: () => Promise<void>;
  startFileTranscription: () => Promise<void>;
  saveSettings: () => Promise<void>;
  copyText: (text: string) => Promise<void>;
  downloadModel: (modelId: string) => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  cancelTranscription: (taskId: string) => Promise<void>;
};
