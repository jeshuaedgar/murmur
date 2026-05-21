export type ModelInfo = {
  id: string;
  lab: string;
  name: string;
  description: string;
  url: string;
  fileName: string;
  recommended: boolean;
  fastest: boolean;
  bestQuality: boolean;
  sizeBytes?: number;
};

export type InstalledModel = {
  id: string;
  installed: boolean;
  path?: string;
  sizeBytes?: number;
};

export type DownloadTaskInfo = {
  taskId: string;
  modelId: string;
  status: "queued" | "running";
};

export type DownloadProgressEvent = {
  taskId: string;
  modelId: string;
  downloadedBytes: number;
  totalBytes?: number;
  progressPct?: number;
};

export type AudioInputDevice = {
  id: string;
  label: string;
  isDefault: boolean;
};

export type ConnectivityStatus = {
  online: boolean;
  huggingfaceReachable: boolean;
  detail?: string;
};
