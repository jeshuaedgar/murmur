import { useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { BaseDirectory, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { api } from "@/lib/api/tauri";
import type { AppSettings } from "@/lib/types/settings";
import { requireTauri } from "@/lib/runtime/tauri";
import { toastInfo } from "@/lib/toast";

type UseTranscriptionActionsParams = {
  settings: AppSettings;
  settingsRef: MutableRefObject<AppSettings>;
  appDataDir: string;
  isRecording: boolean;
  liveMode: boolean;
  setIsRecording: Dispatch<SetStateAction<boolean>>;
  setStatus: Dispatch<SetStateAction<string>>;
  setTranscript: Dispatch<SetStateAction<string>>;
  setActiveTranscriptionTaskId: Dispatch<SetStateAction<string | null>>;
  copyText: (text: string) => Promise<void>;
  refreshBrowserAudioInputs: () => Promise<void>;
};

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let off = 0;

  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(off++, value.charCodeAt(i));
  };

  writeString("RIFF");
  view.setUint32(off, 36 + dataSize, true);
  off += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(off, 16, true);
  off += 4;
  view.setUint16(off, 1, true);
  off += 2;
  view.setUint16(off, 1, true);
  off += 2;
  view.setUint32(off, sampleRate, true);
  off += 4;
  view.setUint32(off, byteRate, true);
  off += 4;
  view.setUint16(off, blockAlign, true);
  off += 2;
  view.setUint16(off, 16, true);
  off += 2;
  writeString("data");
  view.setUint32(off, dataSize, true);
  off += 4;

  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    off += 2;
  }

  return new Uint8Array(buffer);
}

function normalizeTranscriptText(text: string) {
  return text
    .replace(/\[BLANK_AUDIO\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function useTranscriptionActions({
  settings,
  settingsRef,
  appDataDir,
  isRecording,
  liveMode,
  setIsRecording,
  setStatus,
  setTranscript,
  setActiveTranscriptionTaskId,
  copyText,
  refreshBrowserAudioInputs,
}: UseTranscriptionActionsParams) {
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const liveTimerRef = useRef<number | null>(null);
  const liveInFlightRef = useRef(false);

  function mergeChunks(chunks: Float32Array[]) {
    const totalSamples = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }

  async function startRecording() {
    if (isRecording) return;

    const constraints: MediaStreamConstraints = settings.audioInputDeviceId
      ? { audio: { deviceId: { exact: settings.audioInputDeviceId } } }
      : { audio: true };

    streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
    await refreshBrowserAudioInputs();

    audioCtxRef.current = new AudioContext();
    const source = audioCtxRef.current.createMediaStreamSource(streamRef.current);
    processorRef.current = audioCtxRef.current.createScriptProcessor(4096, 1, 1);
    chunksRef.current = [];

    processorRef.current.onaudioprocess = (event) => {
      chunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };

    source.connect(processorRef.current);
    processorRef.current.connect(audioCtxRef.current.destination);
    setIsRecording(true);

    if (liveMode) {
      liveTimerRef.current = window.setInterval(async () => {
        if (!audioCtxRef.current || liveInFlightRef.current) return;

        const totalSamples = chunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
        if (totalSamples < audioCtxRef.current.sampleRate) return;
        const chunkSnapshot = chunksRef.current;
        chunksRef.current = [];
        const merged = mergeChunks(chunkSnapshot);

        try {
          liveInFlightRef.current = true;
          const result = await api.transcribePcm(Array.from(merged), audioCtxRef.current.sampleRate, {
            modelId: settingsRef.current.defaultModelId,
            language: settingsRef.current.language === "auto" ? null : settingsRef.current.language,
            translate: settingsRef.current.translate,
          });
          const cleaned = normalizeTranscriptText(result.text);
          if (cleaned.length > 0) {
            setTranscript((current) => {
              if (!current.trim()) return cleaned;
              return `${current.trimEnd()} ${cleaned}`;
            });
          }
        } catch {
          // keep recording if partial request fails
          chunksRef.current = [...chunkSnapshot, ...chunksRef.current];
        } finally {
          liveInFlightRef.current = false;
        }
      }, 2000);
    }

    setStatus("recording");
  }

  async function stopRecordingAndTranscribe() {
    requireTauri("Recording transcription");
    if (!isRecording || !audioCtxRef.current) return;

    if (liveTimerRef.current) {
      window.clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }

    try {
      const sampleRate = audioCtxRef.current.sampleRate;
      processorRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      await audioCtxRef.current.close();

      const merged = mergeChunks(chunksRef.current);
      const wav = encodeWav(merged, sampleRate);

      setStatus("transcribing");

      const result = await api.transcribePcm(Array.from(merged), sampleRate, {
        modelId: settings.defaultModelId,
        language: settings.language === "auto" ? null : settings.language,
        translate: settings.translate,
      });

      const cleaned = normalizeTranscriptText(result.text);
      if (cleaned.length > 0) {
        setTranscript((current) => {
          if (!current.trim()) return cleaned;
          return `${current.trimEnd()} ${cleaned}`;
        });
        if (settings.autoCopy) await copyText(cleaned);
      }

      // Keep local WAV files as a convenience, but do not fail transcription if permissions block writes.
      try {
        await mkdir("recordings", { baseDir: BaseDirectory.AppData, recursive: true });
        const stamp = Date.now();
        const fileName = `recordings/recording-${stamp}.wav`;
        await writeFile(fileName, wav, { baseDir: BaseDirectory.AppData });
        if (appDataDir) {
          setStatus(`done (saved: ${appDataDir}/${fileName})`);
          return;
        }
      } catch {
        // no-op: live/local transcription should work even without recording directory permissions
      }

      setStatus("done");
    } finally {
      setIsRecording(false);
      processorRef.current = null;
      streamRef.current = null;
      audioCtxRef.current = null;
      chunksRef.current = [];
    }
  }

  async function startFileTranscription() {
    requireTauri("File transcription");
    const file = await open({ multiple: false });
    if (!file || Array.isArray(file)) {
      toastInfo("Import canceled", "No WAV file was selected.");
      return;
    }

    const task = await api.startTranscriptionFile(file, {
      modelId: settings.defaultModelId,
      language: settings.language === "auto" ? null : settings.language,
      translate: settings.translate,
    });

    setActiveTranscriptionTaskId(task.taskId);
    setStatus("transcription queued");
    toastInfo("File transcription queued");
  }

  function teardownRecordingResources() {
    if (liveTimerRef.current) window.clearInterval(liveTimerRef.current);
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  return {
    startRecording,
    stopRecordingAndTranscribe,
    startFileTranscription,
    teardownRecordingResources,
  };
}
