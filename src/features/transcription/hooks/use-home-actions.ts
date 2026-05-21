import { useCallback } from "react";
import { getErrorMessage, toastError, toastInfo, toastWarning } from "@/lib/toast";
import type { CleanupStrategy } from "@/features/transcription/cleanup/types";

type UseHomeActionsArgs = {
  isRecording: boolean;
  activeTranscriptionTaskId: string | null;
  setStatus: (value: string) => void;
  setTranscript: (value: string) => void;
  setRawTranscript: (value: string) => void;
  setCleanupStrategy: (value: CleanupStrategy) => void;
  startRecording: () => Promise<void>;
  stopRecordingAndTranscribe: () => Promise<void>;
  startFileTranscription: () => Promise<void>;
  cancelTranscription: (taskId: string) => Promise<void>;
};

export function useHomeActions({
  isRecording,
  activeTranscriptionTaskId,
  setStatus,
  setTranscript,
  setRawTranscript,
  setCleanupStrategy,
  startRecording,
  stopRecordingAndTranscribe,
  startFileTranscription,
  cancelTranscription,
}: UseHomeActionsArgs) {
  const withActionErrorHandling = useCallback(
    async (action: () => Promise<void>, fallbackMessage: string) => {
      try {
        await action();
      } catch (error) {
        setStatus(getErrorMessage(error, fallbackMessage));
        toastError(error, fallbackMessage);
      }
    },
    [setStatus],
  );

  const onRecordToggle = useCallback(async () => {
    await withActionErrorHandling(
      () => (isRecording ? stopRecordingAndTranscribe() : startRecording()),
      "Recording failed",
    );
  }, [isRecording, startRecording, stopRecordingAndTranscribe, withActionErrorHandling]);

  const onImportAudio = useCallback(async () => {
    await withActionErrorHandling(() => startFileTranscription(), "File transcription failed");
  }, [startFileTranscription, withActionErrorHandling]);

  const onCancelTranscription = useCallback(async () => {
    if (!activeTranscriptionTaskId) {
      toastWarning("No active transcription", "Start a transcription before trying to cancel.");
      return;
    }
    await withActionErrorHandling(
      () => cancelTranscription(activeTranscriptionTaskId),
      "Failed to cancel transcription",
    );
  }, [activeTranscriptionTaskId, cancelTranscription, withActionErrorHandling]);

  const onClearTranscript = useCallback(() => {
    setTranscript("");
    setRawTranscript("");
    setCleanupStrategy("raw");
    toastInfo("Transcript cleared");
  }, [setCleanupStrategy, setRawTranscript, setTranscript]);

  return {
    onRecordToggle,
    onImportAudio,
    onCancelTranscription,
    onClearTranscript,
  };
}
