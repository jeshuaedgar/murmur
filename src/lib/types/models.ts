export type ModelInfo = {
  id: string;
  name: string;
  description: string;
  url: string;
  fileName: string;
  recommended: boolean;
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
