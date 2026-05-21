import { useCallback, useMemo } from "react";
import { toastError, toastSuccess, toastWarning } from "@/lib/toast";

type UseHomeViewModelArgs = {
  isRecording: boolean;
  activeTranscriptionTaskId: string | null;
  transcript: string;
  setTranscript: (value: string) => void;
  copyText: (text: string) => Promise<void>;
};

export function useHomeViewModel({
  isRecording,
  activeTranscriptionTaskId,
  transcript,
  setTranscript,
  copyText,
}: UseHomeViewModelArgs) {
  const isBusy = Boolean(activeTranscriptionTaskId);
  const showRecordingBadge = isRecording;

  const recordButtonLabel = useMemo(
    () => (isRecording ? "Stop & Transcribe" : "Start Recording"),
    [isRecording],
  );

  const onCopyTranscript = useCallback(async () => {
    const text = transcript.trim();
    if (!text) {
      toastWarning("Nothing to copy", "Transcript is empty.");
      return;
    }
    try {
      await copyText(text);
      toastSuccess("Transcript copied");
    } catch (error) {
      toastError(error, "Failed to copy transcript");
    }
  }, [copyText, transcript]);

  const onTranscriptChange = useCallback(
    (value: string) => {
      setTranscript(value);
    },
    [setTranscript],
  );

  return {
    isBusy,
    showRecordingBadge,
    recordButtonLabel,
    onCopyTranscript,
    onTranscriptChange,
  };
}
