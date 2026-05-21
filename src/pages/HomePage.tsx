import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AudioLines, CircleX, Copy, Eraser, FileAudio2, Mic, Square } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/context/app-state";
import { getErrorMessage, toastError } from "@/lib/toast";
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

  const isBusy = Boolean(activeTranscriptionTaskId);

  return (
    <div className="space-y-4">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Model: {settings.defaultModelId}</Badge>
          <Badge>{status}</Badge>
          {isRecording && <Badge variant="outline">Recording</Badge>}
        </div>
        <h1 className="inline-flex items-center gap-2">
          <AudioLines className="size-5" />
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
              onClick={() => {
                void (isRecording ? stopRecordingAndTranscribe() : startRecording()).catch((error) => {
                  setStatus(getErrorMessage(error, "Recording failed"));
                  toastError(error, "Recording failed");
                });
              }}
            >
              {isRecording ? (
                <>
                  <Square className="size-4" />
                  Stop & Transcribe
                </>
              ) : (
                <>
                  <Mic className="size-4" />
                  Start Recording
                </>
              )}
            </Button>

            <Button
              variant="outline"
              disabled={isBusy}
              onClick={() =>
                void startFileTranscription().catch((error) => {
                  setStatus(getErrorMessage(error, "File transcription failed"));
                  toastError(error, "File transcription failed");
                })
              }
            >
              <FileAudio2 className="size-4" />
              Import WAV
            </Button>

            {isBusy && (
              <Button
                variant="outline"
                onClick={() =>
                  void cancelTranscription(activeTranscriptionTaskId!).catch((error) => {
                    setStatus(getErrorMessage(error, "Failed to cancel transcription"));
                    toastError(error, "Failed to cancel transcription");
                  })
                }
              >
                <CircleX className="size-4" />
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
            <Button variant="secondary" onClick={() => void copyText(transcript)}>
              <Copy className="size-4" />
              Copy
            </Button>
            <Button variant="secondary" onClick={() => setTranscript("")}>
              <Eraser className="size-4" />
              Clear
            </Button>
          </div>
          <Textarea
            aria-label="Transcript text"
            rows={16}
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
          />
        </CardContent>
      </Card>

      {!isTauriRuntime && (
        <Card>
          <CardContent className="py-3">
            <p>
              Web preview mode: backend commands are disabled. Run <code>npm run tauri dev</code> for full functionality.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
