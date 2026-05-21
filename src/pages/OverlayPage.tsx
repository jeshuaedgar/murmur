import { Pin, PinOff, Mic, Square, X } from "lucide-react";
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/context/app-state";
import { useHomeActions } from "@/features/transcription/hooks/use-home-actions";
import { api } from "@/lib/api/tauri";
import { isTauriRuntime } from "@/lib/runtime/tauri";
import { toastError } from "@/lib/toast";

export function OverlayPage() {
  const {
    isRecording,
    activeTranscriptionTaskId,
    transcript,
    rawTranscript,
    settings,
    setStatus,
    setTranscript,
    setRawTranscript,
    setCleanupStrategy,
    setSettings,
    startRecording,
    stopRecordingAndTranscribe,
    startFileTranscription,
    cancelTranscription,
  } = useAppState();

  const { onRecordToggle } = useHomeActions({
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
  });

  const visibleTranscript = settings.cleanupShowRawToggle ? (transcript || rawTranscript) : transcript;

  async function onHideOverlay() {
    try {
      if (settings.overlayEnabled) {
        return;
      }
      if (settings.overlayHideStopsRecording && isRecording) {
        await stopRecordingAndTranscribe();
      }
      await api.hideOverlay();
    } catch (error) {
      toastError(error, "Failed to hide overlay");
    }
  }

  useEffect(() => {
    if (!isTauriRuntime) return;
    const attachListener = async () =>
      listen("overlay-hotkey-pressed", () => {
        void onRecordToggle();
      });
    const unlistenPromise = attachListener();
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [onRecordToggle]);

  async function onPinToggle() {
    const nextPinned = !settings.overlayPinned;
    setSettings((prev) => ({ ...prev, overlayPinned: nextPinned }));
    try {
      await api.setOverlayPinned(nextPinned);
    } catch (error) {
      setSettings((prev) => ({ ...prev, overlayPinned: !nextPinned }));
      toastError(error, "Failed to update overlay pin");
    }
  }

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <div
        className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-muted/40 p-1.5"
        data-tauri-drag-region
      >
        <Badge variant={isRecording ? "secondary" : "outline"}>
          {isRecording ? "Recording" : "Idle"}
        </Badge>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            aria-label={settings.overlayPinned ? "Unpin overlay" : "Pin overlay"}
            onClick={() => void onPinToggle()}
          >
            {settings.overlayPinned ? <Pin /> : <PinOff />}
          </Button>
          <Button size="sm" onClick={() => void onRecordToggle()}>
            {isRecording ? <Square /> : <Mic />}
            {isRecording ? "Stop" : "Record"}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Hide overlay"
            disabled={settings.overlayEnabled}
            onClick={() => void onHideOverlay()}
          >
            <X />
          </Button>
        </div>
      </div>
      <Textarea
        aria-label="Live transcript preview"
        className="h-full min-h-24 resize-none text-sm"
        value={visibleTranscript}
        onChange={(event) => setTranscript(event.target.value)}
      />
    </div>
  );
}
