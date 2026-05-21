import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircleX, Copy, Eraser, FileAudio2, House, Mic, Square } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/context/app-state";
import { useHomeActions } from "@/features/transcription/hooks/use-home-actions";
import { useHomeViewModel } from "@/features/transcription/hooks/use-home-view-model";
import { isTauriRuntime } from "@/lib/runtime/tauri";

function getStatusBadgeVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  const normalized = status.toLowerCase();
  if (
    normalized.includes("failed") ||
    normalized.includes("error") ||
    normalized.includes("offline") ||
    normalized.includes("canceled")
  ) {
    return "destructive";
  }
  if (
    normalized.includes("done") ||
    normalized.includes("saved") ||
    normalized.includes("recording") ||
    normalized.includes("transcribing")
  ) {
    return "secondary";
  }
  return "outline";
}

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

  const { onRecordToggle, onImportWav, onCancelTranscription, onClearTranscript } = useHomeActions({
    isRecording,
    activeTranscriptionTaskId,
    setStatus,
    setTranscript,
    startRecording,
    stopRecordingAndTranscribe,
    startFileTranscription,
    cancelTranscription,
  });
  const { isBusy, showRecordingBadge, recordButtonLabel, onCopyTranscript, onTranscriptChange } = useHomeViewModel({
    isRecording,
    activeTranscriptionTaskId,
    transcript,
    setTranscript,
    copyText,
  });

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Model: {settings.defaultModelId}</Badge>
          <Badge variant={getStatusBadgeVariant(status)}>{status}</Badge>
          {showRecordingBadge && <Badge variant="outline">Recording</Badge>}
        </div>
        <h1 className="inline-flex items-center gap-2">
          <House />
          Transcription Workspace
        </h1>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Capture Controls</CardTitle>
          <CardDescription>Start recording audio or import an existing WAV file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => void onRecordToggle()}
            >
              {isRecording ? (
                <>
                  <Square />
                  {recordButtonLabel}
                </>
              ) : (
                <>
                  <Mic />
                  {recordButtonLabel}
                </>
              )}
            </Button>

            <Button
              variant="outline"
              disabled={isBusy}
              onClick={() => void onImportWav()}
            >
              <FileAudio2 />
              Import WAV
            </Button>

            {isBusy && (
              <Button
                variant="destructive"
                onClick={() => void onCancelTranscription()}
              >
                <CircleX />
                Cancel Transcription
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
            <div className="flex items-center gap-2">
              <Switch checked={liveMode} disabled={isRecording} onCheckedChange={setLiveMode} id="live-mode" />
              <Label htmlFor="live-mode">Live transcription</Label>
            </div>
            <p>
              Live mode is locked while recording to prevent runtime conflicts.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
          <CardDescription>Review, edit, copy, and clear transcribed text.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void onCopyTranscript()}>
              <Copy />
              Copy
            </Button>
            <Button variant="ghost" onClick={onClearTranscript}>
              <Eraser />
              Clear
            </Button>
          </div>
          <Textarea
            aria-label="Transcript text"
            rows={16}
            value={transcript}
            onChange={(event) => onTranscriptChange(event.target.value)}
          />
        </CardContent>
      </Card>

      {!isTauriRuntime && (
        <Card>
          <CardHeader>
            <CardTitle>Web Preview Mode</CardTitle>
            <CardDescription>Backend commands are disabled in browser-only mode.</CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              Web preview mode: backend commands are disabled. Run <code>npm run tauri dev</code> for full functionality.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
