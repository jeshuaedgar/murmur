import { useCallback } from "react";
import { getErrorMessage, toastError } from "@/lib/toast";

type UseHomeActionsArgs = {
  isRecording: boolean;
  activeTranscriptionTaskId: string | null;
  setStatus: (value: string) => void;
  setTranscript: (value: string) => void;
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

  const onImportWav = useCallback(async () => {
    await withActionErrorHandling(() => startFileTranscription(), "File transcription failed");
  }, [startFileTranscription, withActionErrorHandling]);

  const onCancelTranscription = useCallback(async () => {
    if (!activeTranscriptionTaskId) {
      return;
    }
    await withActionErrorHandling(
      () => cancelTranscription(activeTranscriptionTaskId),
      "Failed to cancel transcription",
    );
  }, [activeTranscriptionTaskId, cancelTranscription, withActionErrorHandling]);

  const onClearTranscript = useCallback(() => {
    setTranscript("");
  }, [setTranscript]);

  return {
    onRecordToggle,
    onImportWav,
    onCancelTranscription,
    onClearTranscript,
  };
}
