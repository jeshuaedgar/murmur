import type { DownloadProgressEvent, InstalledModel } from "@/lib/types/models";

export type ModelCardState = {
  progressValue: number;
  hasProgress: boolean;
  isInstalled: boolean;
  isDownloading: boolean;
  actionLabel: string;
  statusLabel: string;
  statusBadgeVariant: "default" | "secondary" | "outline";
  installButtonVariant: "default" | "secondary";
};

export function getModelCardState({
  installedModel,
  progress,
}: {
  installedModel?: InstalledModel;
  progress?: DownloadProgressEvent;
}): ModelCardState {
  const progressPct = progress?.progressPct;
  const hasProgress = typeof progressPct === "number";
  const progressValue = hasProgress ? Math.max(0, Math.min(progressPct, 100)) : 0;
  const isInstalled = Boolean(installedModel?.installed);
  const isDownloading = hasProgress && progressValue < 100;
  const actionLabel = isInstalled ? "Reinstall model" : "Install model";
  const statusLabel = isDownloading ? "Downloading" : isInstalled ? "Installed locally" : "Not installed";
  const statusBadgeVariant = isDownloading ? "secondary" : isInstalled ? "default" : "outline";
  const installButtonVariant = isInstalled ? "secondary" : "default";

  return {
    progressValue,
    hasProgress,
    isInstalled,
    isDownloading,
    actionLabel,
    statusLabel,
    statusBadgeVariant,
    installButtonVariant,
  };
}

export function getModelProgressByModelId(downloadProgress: Map<string, DownloadProgressEvent>) {
  const progressByModelId = new Map<string, DownloadProgressEvent>();
  for (const progressEvent of downloadProgress.values()) {
    progressByModelId.set(progressEvent.modelId, progressEvent);
  }
  return progressByModelId;
}
