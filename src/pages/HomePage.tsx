import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/context/app-state";
import { isTauriRuntime } from "@/lib/runtime/tauri";

export function HomePage() {
  const {
    settings,
    status,
    isRecording,
    liveMode,
    activeTranscriptionTaskId,
    transcript,
    setLiveMode,
    setStatus,
    setTranscript,
    startRecording,
    stopRecordingAndTranscribe,
    startFileTranscription,
    cancelTranscription,
    copyText,
  } = useAppState();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Model: {settings.defaultModelId}</Badge>
        <Badge>{status}</Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => {
            void (isRecording ? stopRecordingAndTranscribe() : startRecording()).catch((error) =>
              setStatus(`error: ${String(error)}`),
            );
          }}
        >
          {isRecording ? "Stop & Transcribe" : "Start Recording"}
        </Button>

        <div className="flex items-center gap-2">
          <Switch checked={liveMode} disabled={isRecording} onCheckedChange={setLiveMode} id="live-mode" />
          <Label htmlFor="live-mode">Live transcription</Label>
        </div>

        <Button
          variant="outline"
          disabled={!!activeTranscriptionTaskId}
          onClick={() => void startFileTranscription().catch((error) => setStatus(`error: ${String(error)}`))}
        >
          Import WAV
        </Button>

        {activeTranscriptionTaskId && (
          <Button
            variant="outline"
            onClick={() => void cancelTranscription(activeTranscriptionTaskId).catch((error) => setStatus(`error: ${String(error)}`))}
          >
            Cancel Transcription
          </Button>
        )}

        <Button variant="secondary" onClick={() => void copyText(transcript)}>
          Copy
        </Button>
        <Button variant="secondary" onClick={() => setTranscript("")}>
          Clear
        </Button>
      </div>

      <Textarea rows={16} value={transcript} onChange={(event) => setTranscript(event.target.value)} />

      {!isTauriRuntime && (
        <p className="text-sm text-muted-foreground">
          Web preview mode: backend commands are disabled. Run <code>npm run tauri dev</code> for full functionality.
        </p>
      )}
    </div>
  );
}
