import { describe, expect, it } from "vitest";
import type { DownloadProgressEvent } from "@/lib/types/models";
import { clearDownloadTask, mergePendingDownloadProgress } from "@/context/hooks/download-progress-state";

function progressEvent(overrides: Partial<DownloadProgressEvent> = {}): DownloadProgressEvent {
  return {
    taskId: "task-1",
    modelId: "distil-whisper:distil-small.en",
    downloadedBytes: 50,
    totalBytes: 100,
    progressPct: 50,
    ...overrides,
  };
}

describe("download progress state helpers", () => {
  it("merges pending progress and normalizes percentages", () => {
    const prev = new Map<string, DownloadProgressEvent>([
      ["task-1", progressEvent({ progressPct: 80, downloadedBytes: 80 })],
    ]);
    const pending = [progressEvent({ progressPct: 40, downloadedBytes: 40 })];

    const next = mergePendingDownloadProgress({
      previousByTaskId: prev,
      pendingEvents: pending,
      terminalTaskIds: new Set(),
    });

    expect(next.get("task-1")?.progressPct).toBe(80);
  });

  it("ignores pending events for completed tasks", () => {
    const prev = new Map<string, DownloadProgressEvent>();
    const pending = [progressEvent({ progressPct: 100, downloadedBytes: 100 })];
    const terminalTaskIds = new Set(["task-1"]);

    const next = mergePendingDownloadProgress({
      previousByTaskId: prev,
      pendingEvents: pending,
      terminalTaskIds,
    });

    expect(next.has("task-1")).toBe(false);
  });

  it("clears active and pending progress for terminal task", () => {
    const previousByTaskId = new Map<string, DownloadProgressEvent>([
      ["task-1", progressEvent()],
    ]);
    const pendingByTaskId = new Map<string, DownloadProgressEvent>([
      ["task-1", progressEvent({ progressPct: 100, downloadedBytes: 100 })],
    ]);
    const terminalTaskIds = new Set<string>();

    const next = clearDownloadTask({
      previousByTaskId,
      pendingByTaskId,
      terminalTaskIds,
      taskId: "task-1",
    });

    expect(next.has("task-1")).toBe(false);
    expect(pendingByTaskId.has("task-1")).toBe(false);
    expect(terminalTaskIds.has("task-1")).toBe(true);
  });
});
