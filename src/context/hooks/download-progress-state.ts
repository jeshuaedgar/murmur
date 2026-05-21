import type { DownloadProgressEvent } from "@/lib/types/models";

export function mergePendingDownloadProgress({
  previousByTaskId,
  pendingEvents,
  terminalTaskIds,
}: {
  previousByTaskId: Map<string, DownloadProgressEvent>;
  pendingEvents: Iterable<DownloadProgressEvent>;
  terminalTaskIds: ReadonlySet<string>;
}): Map<string, DownloadProgressEvent> {
  const next = new Map(previousByTaskId);
  for (const pendingEvent of pendingEvents) {
    if (terminalTaskIds.has(pendingEvent.taskId)) {
      continue;
    }

    const previous = next.get(pendingEvent.taskId);
    const inferredPct =
      typeof pendingEvent.totalBytes === "number" && pendingEvent.totalBytes > 0
        ? (pendingEvent.downloadedBytes / pendingEvent.totalBytes) * 100
        : undefined;
    const incomingPct = typeof pendingEvent.progressPct === "number" ? pendingEvent.progressPct : inferredPct;
    const previousPct = previous?.progressPct;
    const normalizedPct =
      typeof incomingPct === "number"
        ? Math.max(0, Math.min(100, Math.max(previousPct ?? 0, incomingPct)))
        : previousPct;

    next.set(pendingEvent.taskId, {
      ...pendingEvent,
      progressPct: normalizedPct,
    });
  }
  return next;
}

export function clearDownloadTask({
  previousByTaskId,
  pendingByTaskId,
  terminalTaskIds,
  taskId,
}: {
  previousByTaskId: Map<string, DownloadProgressEvent>;
  pendingByTaskId: Map<string, DownloadProgressEvent>;
  terminalTaskIds: Set<string>;
  taskId: string;
}): Map<string, DownloadProgressEvent> {
  pendingByTaskId.delete(taskId);
  terminalTaskIds.add(taskId);
  const next = new Map(previousByTaskId);
  next.delete(taskId);
  return next;
}
