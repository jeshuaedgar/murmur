import { CheckCircle2, ChevronDown, ChevronUp, CircleAlert, Mic, Pin, PinOff, Square, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollingWaveform } from "@/components/ui/waveform";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppState } from "@/context/app-state";
import { useHomeActions } from "@/features/transcription/hooks/use-home-actions";
import { api } from "@/lib/api/tauri";
import { isTauriRuntime } from "@/lib/runtime/tauri";
import { toastError } from "@/lib/toast";

type OverlayUiState = "idle" | "recording" | "transcribing" | "done" | "error";

const UI_STATE_META: Record<
  OverlayUiState,
  {
    label: string;
    headline: string;
    detail: string;
    badge: "outline" | "secondary" | "default";
    tone: string;
    accent: string;
  }
> = {
  idle: {
    label: "Idle",
    headline: "Ready",
    detail: "Press record or use your hotkey to start.",
    badge: "outline",
    tone: "border-zinc-300/80 bg-white/85 text-zinc-900",
    accent: "bg-zinc-500",
  },
  recording: {
    label: "Recording",
    headline: "Listening",
    detail: "Speak naturally, then stop to transcribe.",
    badge: "secondary",
    tone: "border-rose-300/80 bg-rose-50/95 text-rose-900",
    accent: "bg-rose-500",
  },
  transcribing: {
    label: "Transcribing",
    headline: "Processing",
    detail: "A waveform shows activity while processing.",
    badge: "secondary",
    tone: "border-cyan-300/80 bg-cyan-50/95 text-cyan-900",
    accent: "bg-cyan-500",
  },
  done: {
    label: "Done",
    headline: "Ready to paste",
    detail: "Text is prepared and auto-pasted on completion.",
    badge: "default",
    tone: "border-emerald-300/80 bg-emerald-50/95 text-emerald-900",
    accent: "bg-emerald-500",
  },
  error: {
    label: "Error",
    headline: "Could not transcribe",
    detail: "Try recording again.",
    badge: "secondary",
    tone: "border-amber-300/80 bg-amber-50/95 text-amber-900",
    accent: "bg-amber-500",
  },
};

export function OverlayPage() {
  const {
    isRecording,
    activeTranscriptionTaskId,
    transcript,
    rawTranscript,
    status,
    settings,
    setStatus,
    setTranscript,
    setRawTranscript,
    setCleanupStrategy,
    setSettings,
    copyText,
    startRecording,
    stopRecordingAndTranscribe,
    startFileTranscription,
    cancelTranscription,
  } = useAppState();

  const { onRecordToggle, onClearTranscript } = useHomeActions({
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

  const [isExpanded, setIsExpanded] = useState(false);
  const [waveformSeed, setWaveformSeed] = useState(() => Math.random());
  const lastToggleAtRef = useRef(0);

  const visibleTranscript = settings.cleanupShowRawToggle ? transcript || rawTranscript : transcript;
  const normalizedStatus = status.trim().toLowerCase();
  const isTranscribing =
    !isRecording &&
    (activeTranscriptionTaskId !== null || normalizedStatus.includes("transcrib") || normalizedStatus.includes("queued") || normalizedStatus.includes("preparing"));

  const uiState = useMemo<OverlayUiState>(() => {
    if (isRecording) return "recording";
    if (isTranscribing) return "transcribing";
    if (normalizedStatus.includes("error") || normalizedStatus.includes("failed")) return "error";
    if (normalizedStatus.startsWith("done")) return "done";
    return "idle";
  }, [isRecording, isTranscribing, normalizedStatus]);

  const stateMeta = UI_STATE_META[uiState];
  const hasTranscript = visibleTranscript.trim().length > 0;
  const closeDisabled = settings.overlayEnabled;

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

  async function handleRecordToggle() {
    if (isTranscribing) return;
    const now = Date.now();
    if (now - lastToggleAtRef.current < 300) return;
    lastToggleAtRef.current = now;
    await onRecordToggle();
  }

  useEffect(() => {
    if (!isTauriRuntime) return;
    const attachListener = async () =>
      listen("overlay-hotkey-pressed", () => {
        void handleRecordToggle();
      });
    const unlistenPromise = attachListener();
    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [handleRecordToggle]);

  useEffect(() => {
    if (uiState === "recording" || uiState === "transcribing") {
      setWaveformSeed(Math.random());
    }
  }, [uiState]);

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

  async function onCopyTranscript() {
    if (!hasTranscript) return;
    await copyText(visibleTranscript);
    setStatus("done");
  }

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col gap-2 p-2 text-[13px]">
        <p className="sr-only" role="status" aria-live={uiState === "error" ? "assertive" : "polite"} aria-atomic="true">
          {stateMeta.label}. {stateMeta.detail}
        </p>

        <div
          className={`rounded-2xl border px-2 py-1.5 shadow-[0_8px_22px_-14px_rgba(0,0,0,0.38)] backdrop-blur-sm transition-all duration-150 ${stateMeta.tone}`}
          data-tauri-drag-region
        >
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`inline-block size-2 rounded-full ${stateMeta.accent}`} />
                <p className="truncate text-sm font-semibold">{stateMeta.headline}</p>
                <Badge variant={stateMeta.badge} className="h-5 px-2 text-[10px] uppercase tracking-[0.08em]">
                  {stateMeta.label}
                </Badge>
              </div>
            </div>

            {(uiState === "recording" || uiState === "transcribing") ? (
              <ScrollingWaveform
                key={waveformSeed}
                aria-label="Voice activity waveform"
                className="h-6 w-28 shrink-0"
                barCount={26}
                barGap={2}
                barWidth={3}
                fadeEdges={false}
                speed={uiState === "recording" ? 56 : 34}
              />
            ) : null}

            <Button
              aria-label={isRecording ? "Stop recording" : "Start recording"}
              className="h-8 rounded-xl px-3 font-semibold"
              disabled={isTranscribing}
              onClick={() => void handleRecordToggle()}
              size="sm"
            >
              {isRecording ? <Square className="size-4" /> : <Mic className="size-4" />}
              {isRecording ? "Stop" : "Record"}
            </Button>

            <Button
              aria-label={isExpanded ? "Collapse transcript panel" : "Expand transcript panel"}
              onClick={() => setIsExpanded((prev) => !prev)}
              className="h-8 w-8 rounded-xl"
              size="icon"
              variant="ghost"
            >
              {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          </div>
        </div>

        {isExpanded ? (
          <section className="rounded-xl border border-zinc-300/70 bg-white/95 p-2 shadow-[0_14px_28px_-20px_rgba(0,0,0,0.45)] backdrop-blur-sm transition-all duration-150">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {uiState === "error" ? <CircleAlert className="size-4 text-amber-600" /> : null}
                {uiState === "done" ? <CheckCircle2 className="size-4 text-emerald-600" /> : null}
                <p className="line-clamp-1 text-xs font-medium text-zinc-700">{stateMeta.detail}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button disabled={!hasTranscript} onClick={() => void onCopyTranscript()} size="sm" variant="secondary">
                  Copy
                </Button>
                <Button disabled={!hasTranscript} onClick={onClearTranscript} size="sm" variant="ghost">
                  Clear
                </Button>
              </div>
            </div>

            <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50/80 p-2">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-900">
                {hasTranscript ? visibleTranscript : "Transcript preview will appear here."}
              </p>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label={settings.overlayPinned ? "Unpin overlay" : "Pin overlay"}
                      onClick={() => void onPinToggle()}
                      size="icon"
                      variant="ghost"
                    >
                      {settings.overlayPinned ? <Pin className="size-4" /> : <PinOff className="size-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{settings.overlayPinned ? "Overlay pinned" : "Overlay not pinned"}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        aria-label="Hide overlay"
                        disabled={closeDisabled}
                        onClick={() => void onHideOverlay()}
                        size="icon"
                        variant="ghost"
                      >
                        <X className="size-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {closeDisabled
                      ? "Overlay hide is locked while Overlay Enabled is on."
                      : "Hide overlay"}
                  </TooltipContent>
                </Tooltip>
              </div>

              <p className="text-[11px] text-muted-foreground">
                {closeDisabled ? "Turn off Overlay Enabled in Settings to allow hide." : "Overlay can be hidden."}
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
