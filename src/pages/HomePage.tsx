import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Eraser, FileAudio2, House, Mic, Square } from "lucide-react";
import { useState } from "react";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAppState } from "@/context/app-state";
import { useHomeActions } from "@/features/transcription/hooks/use-home-actions";
import { useHomeViewModel } from "@/features/transcription/hooks/use-home-view-model";
import { isTauriRuntime } from "@/lib/runtime/tauri";

export function HomePage() {
  const {
    settings,
    isRecording,
    liveMode,
    activeTranscriptionTaskId,
    transcript,
    rawTranscript,
    setLiveMode,
    setStatus,
    setTranscript,
    setRawTranscript,
    setCleanupStrategy,
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
    setRawTranscript,
    setCleanupStrategy,
    startRecording,
    stopRecordingAndTranscribe,
    startFileTranscription,
    cancelTranscription,
  });
  const { isBusy, recordButtonLabel, onCopyTranscript, onTranscriptChange } = useHomeViewModel({
    isRecording,
    activeTranscriptionTaskId,
    transcript,
    setTranscript,
    copyText,
  });
  const [showRawTranscript, setShowRawTranscript] = useState(false);
  const visibleTranscript =
    settings.cleanupShowRawToggle && showRawTranscript ? rawTranscript : transcript;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-2xl md:text-3xl">
            <House className="size-5" />
            Transcription Workspace
          </CardTitle>
          <CardDescription>Capture audio, transcribe, and review cleaned output in one flow.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Capture Controls</CardTitle>
          <CardDescription>Start recording audio or import an existing WAV file.</CardDescription>
          <CardAction>
            <Badge variant={isRecording ? "secondary" : "outline"}>
              {isRecording ? "Recording active" : "Idle"}
            </Badge>
          </CardAction>
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
                <Spinner />
                Cancel Transcription
              </Button>
            )}
          </div>

        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={liveMode} disabled={isRecording} onCheckedChange={setLiveMode} id="live-mode" />
            <Label htmlFor="live-mode">Live transcription</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Live mode is locked while recording to prevent runtime conflicts.
          </p>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transcript</CardTitle>
          <CardDescription>Review, edit, copy, and clear transcribed text.</CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => void onCopyTranscript()}>
                <Copy />
                Copy
              </Button>
              {settings.cleanupShowRawToggle && (
                <Button
                  variant="outline"
                  onClick={() => setShowRawTranscript((current) => !current)}
                >
                  {showRawTranscript ? "Show Cleaned" : "Show Raw"}
                </Button>
              )}
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Textarea
            aria-label="Transcript text"
            rows={16}
            value={visibleTranscript}
            onChange={(event) => onTranscriptChange(event.target.value)}
          />
        </CardContent>
        <CardFooter>
          <Button variant="ghost" onClick={onClearTranscript}>
            <Eraser />
            Clear
          </Button>
        </CardFooter>
      </Card>

      {!isTauriRuntime && (
        <Card>
          <CardHeader>
            <CardTitle>Web Preview Mode</CardTitle>
            <CardDescription>Backend commands are disabled in browser-only mode.</CardDescription>
            <CardAction>
              <Badge variant="outline">Preview only</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Web preview mode: backend commands are disabled. Run <code>npm run tauri dev</code> for full functionality.
            </p>
          </CardContent>
          <CardFooter>
            <p className="text-xs text-muted-foreground">Desktop runtime is required for native file and audio integration.</p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
