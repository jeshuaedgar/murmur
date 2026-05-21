import { useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { BaseDirectory, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { api } from "./lib/api/tauri";
import type { AppSettings } from "./lib/types/settings";
import type {
  AudioInputDevice,
  DownloadProgressEvent,
  InstalledModel,
  ModelInfo,
} from "./lib/types/models";
import type { TranscriptionResult } from "./lib/types/transcription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

const isTauriRuntime =
  typeof window !== "undefined" &&
  typeof (window as typeof window & { __TAURI_INTERNALS__?: { invoke?: unknown } })
    .__TAURI_INTERNALS__?.invoke === "function";

function requireTauri(feature: string) {
  if (isTauriRuntime) return;
  throw new Error(`${feature} requires Tauri runtime. Use 'npm run tauri dev'.`);
}

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let off = 0;
  const writeString = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off++, s.charCodeAt(i));
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
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Uint8Array(buffer);
}

export default function App() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [installed, setInstalled] = useState<InstalledModel[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    defaultModelId: "small",
    language: "auto",
    translate: false,
    autoCopy: false,
    audioInputDeviceId: null,
  });
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("idle");
  const [appDataDir, setAppDataDir] = useState("");
  const [activeTab, setActiveTab] = useState("home");
  const [isRecording, setIsRecording] = useState(false);
  const [liveMode, setLiveMode] = useState(true);
  const [activeTranscriptionTaskId, setActiveTranscriptionTaskId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<Map<string, DownloadProgressEvent>>(new Map());
  const [backendAudioInputs, setBackendAudioInputs] = useState<AudioInputDevice[]>([]);
  const [browserAudioInputs, setBrowserAudioInputs] = useState<Array<{ id: string; label: string }>>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const liveTimerRef = useRef<number | null>(null);
  const liveInFlightRef = useRef(false);

  const installedById = useMemo(() => new Map(installed.map((m) => [m.id, m])), [installed]);

  async function copyText(text: string) {
    if (isTauriRuntime) {
      await writeText(text);
      return;
    }
    await navigator.clipboard.writeText(text);
  }

  async function refreshBrowserAudioInputs() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices
      .filter((d) => d.kind === "audioinput")
      .map((d) => ({ id: d.deviceId, label: d.label || "Microphone" }));
    setBrowserAudioInputs(inputs);
    if (!settings.audioInputDeviceId && inputs.length > 0) {
      setSettings((prev) => ({ ...prev, audioInputDeviceId: inputs[0].id }));
    }
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
    processorRef.current.onaudioprocess = (e) => {
      chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    source.connect(processorRef.current);
    processorRef.current.connect(audioCtxRef.current.destination);
    setIsRecording(true);

    if (liveMode) {
      liveTimerRef.current = window.setInterval(async () => {
        if (!audioCtxRef.current || liveInFlightRef.current) return;
        const total = chunksRef.current.reduce((n, c) => n + c.length, 0);
        if (total < audioCtxRef.current.sampleRate) return;

        const merged = new Float32Array(total);
        let offset = 0;
        for (const c of chunksRef.current) {
          merged.set(c, offset);
          offset += c.length;
        }

        try {
          liveInFlightRef.current = true;
          const result = await api.transcribePcm(Array.from(merged), audioCtxRef.current.sampleRate, {
            modelId: settings.defaultModelId,
            language: settings.language === "auto" ? null : settings.language,
            translate: settings.translate,
          });
          if (result.text.trim().length > 0) {
            setTranscript(result.text);
          }
        } catch {
          // keep recording
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

    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    await audioCtxRef.current.close();

    const total = chunksRef.current.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(total);
    let offset = 0;
    for (const c of chunksRef.current) {
      merged.set(c, offset);
      offset += c.length;
    }

    const wav = encodeWav(merged, audioCtxRef.current.sampleRate);
    await mkdir("recordings", { baseDir: BaseDirectory.AppData, recursive: true });
    const stamp = Date.now();
    const fileName = `recordings/recording-${stamp}.wav`;
    await writeFile(fileName, wav, { baseDir: BaseDirectory.AppData });

    setIsRecording(false);
    setStatus("transcribing");
    const fullPath = `${appDataDir}/recordings/recording-${stamp}.wav`;
    const result = await api.transcribeRecording(fullPath, {
      modelId: settings.defaultModelId,
      language: settings.language === "auto" ? null : settings.language,
      translate: settings.translate,
    });
    setTranscript(result.text);
    if (settings.autoCopy && result.text) await copyText(result.text);
    setStatus("done");
  }

  async function startFileTranscription() {
    requireTauri("File transcription");
    const file = await open({ multiple: false });
    if (!file || Array.isArray(file)) return;
    const task = await api.startTranscriptionFile(file, {
      modelId: settings.defaultModelId,
      language: settings.language === "auto" ? null : settings.language,
      translate: settings.translate,
    });
    setActiveTranscriptionTaskId(task.taskId);
    setStatus("transcription queued");
  }

  async function saveSettings() {
    await api.saveSettings(settings);
    setStatus("settings saved");
  }

  useEffect(() => {
    let mounted = true;
    const cleanup: Array<() => void> = [];

    const init = async () => {
      if (!isTauriRuntime) {
        if (!mounted) return;
        setStatus("web preview mode");
        setModels([]);
        setInstalled([]);
        setAppDataDir("(Tauri runtime unavailable in plain Vite dev mode)");
        setBackendAudioInputs([]);
        await refreshBrowserAudioInputs();
        return;
      }

      const [allModels, allInstalled, appSettings, dataDir, audioInputs] = await Promise.all([
        api.listModels(),
        api.getInstalledModels(),
        api.getSettings(),
        api.getAppDataDir(),
        api.getAudioInputs(),
      ]);

      if (!mounted) return;
      setModels(allModels);
      setInstalled(allInstalled);
      setSettings(appSettings);
      setAppDataDir(dataDir);
      setBackendAudioInputs(audioInputs);

      try {
        const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        permissionStream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore
      }

      await refreshBrowserAudioInputs();

      cleanup.push(
        await listen<DownloadProgressEvent>("model-download-progress", (event) => {
          setDownloadProgress((prev) => {
            const next = new Map(prev);
            next.set(event.payload.taskId, event.payload);
            return next;
          });
        }),
      );

      cleanup.push(
        await listen<{ taskId: string; modelId: string }>("model-download-complete", async (event) => {
          setDownloadProgress((prev) => {
            const next = new Map(prev);
            next.delete(event.payload.taskId);
            return next;
          });
          setInstalled(await api.getInstalledModels());
          setStatus(`model ${event.payload.modelId} installed`);
        }),
      );

      cleanup.push(
        await listen<{ taskId: string; modelId: string; error: string }>("model-download-error", (event) => {
          setDownloadProgress((prev) => {
            const next = new Map(prev);
            next.delete(event.payload.taskId);
            return next;
          });
          setStatus(`download error (${event.payload.modelId}): ${event.payload.error}`);
        }),
      );

      cleanup.push(
        await listen<{ taskId: string; stage: string; message: string }>("transcription-progress", (event) => {
          setActiveTranscriptionTaskId((current) => {
            if (current === event.payload.taskId) {
              setStatus(`${event.payload.stage}: ${event.payload.message}`);
            }
            return current;
          });
        }),
      );

      cleanup.push(
        await listen<{ taskId: string; result: TranscriptionResult }>("transcription-complete", async (event) => {
          setActiveTranscriptionTaskId((current) => {
            if (current !== event.payload.taskId) return current;
            const nextText = event.payload.result.text;
            setTranscript(nextText);
            if (settings.autoCopy && nextText) {
              void copyText(nextText);
            }
            setStatus("done");
            return null;
          });
        }),
      );

      cleanup.push(
        await listen<{ taskId: string; error: string }>("transcription-error", (event) => {
          setActiveTranscriptionTaskId((current) => {
            if (current !== event.payload.taskId) return current;
            setStatus(`transcription error: ${event.payload.error}`);
            return null;
          });
        }),
      );

      cleanup.push(
        await listen<{ taskId: string }>("transcription-canceled", (event) => {
          setActiveTranscriptionTaskId((current) => {
            if (current !== event.payload.taskId) return current;
            setStatus("transcription canceled");
            return null;
          });
        }),
      );
    };

    init().catch((err) => {
      if (mounted) setStatus(`Bootstrap failed: ${String(err)}`);
    });

    return () => {
      mounted = false;
      cleanup.forEach((unsub) => unsub());
      if (liveTimerRef.current) {
        window.clearInterval(liveTimerRef.current);
      }
      processorRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Whisper Local STT</CardTitle>
          <CardDescription>Offline-first transcription powered by local models.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="home">Home</TabsTrigger>
              <TabsTrigger value="models">Models</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="home" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Model: {settings.defaultModelId}</Badge>
                <Badge>{status}</Badge>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => {
                    void (isRecording ? stopRecordingAndTranscribe() : startRecording()).catch((e) =>
                      setStatus(`error: ${String(e)}`),
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
                  onClick={() => void startFileTranscription().catch((e) => setStatus(`error: ${String(e)}`))}
                >
                  Import WAV
                </Button>
                {activeTranscriptionTaskId && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      void api.cancelTranscription(activeTranscriptionTaskId).then(() => setStatus("cancel requested"))
                    }
                  >
                    Cancel Transcription
                  </Button>
                )}
                <Button variant="secondary" onClick={() => void copyText(transcript)}>
                  Copy
                </Button>
                <Button variant="secondary" onClick={() => setTranscript("")}>Clear</Button>
              </div>

              <Textarea rows={16} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
              {!isTauriRuntime && (
                <p className="text-sm text-muted-foreground">
                  Web preview mode: backend commands are disabled. Run <code>npm run tauri dev</code> for full functionality.
                </p>
              )}
            </TabsContent>

            <TabsContent value="models">
              <div className="mb-3 text-sm text-muted-foreground">Download once from Hugging Face, then run offline.</div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {models.map((m) => {
                  const installedModel = installedById.get(m.id);
                  const progress = Array.from(downloadProgress.values()).find((x) => x.modelId === m.id);
                  return (
                    <Card key={m.id}>
                      <CardHeader>
                        <CardTitle className="text-base">{m.name}</CardTitle>
                        <div className="flex flex-wrap gap-2">
                          {m.recommended && <Badge>Recommended</Badge>}
                          {m.fastest && <Badge variant="secondary">Fastest</Badge>}
                          {m.bestQuality && <Badge variant="outline">Best Quality</Badge>}
                        </div>
                      </CardHeader>
                      <CardContent className="flex flex-col gap-3">
                        <p className="text-sm text-muted-foreground">{m.description}</p>
                        <code className="text-xs">{m.id}</code>
                        <p className="text-sm">{installedModel?.installed ? "Installed" : "Not installed"}</p>
                        {typeof progress?.progressPct === "number" && (
                          <Progress value={Math.max(0, Math.min(progress.progressPct, 100))} />
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={() => void api.downloadModel(m.id)}>
                            {installedModel?.installed ? "Re-download" : "Download"}
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={!installedModel?.installed}
                            onClick={() =>
                              void api.deleteModel(m.id).then(async () => setInstalled(await api.getInstalledModels()))
                            }
                          >
                            Delete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Default model</Label>
                  <Select
                    value={settings.defaultModelId}
                    onValueChange={(value) => setSettings((prev) => ({ ...prev, defaultModelId: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {models.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="language">Language</Label>
                  <Input
                    id="language"
                    value={settings.language}
                    onChange={(e) => setSettings((prev) => ({ ...prev, language: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label>Audio input device</Label>
                  <Select
                    value={settings.audioInputDeviceId ?? ""}
                    onValueChange={(value) =>
                      setSettings((prev) => ({ ...prev, audioInputDeviceId: value || null }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select input" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {browserAudioInputs.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Detected by browser: {browserAudioInputs.length} • Detected by backend: {backendAudioInputs.length}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="translate"
                    checked={settings.translate}
                    onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, translate: checked }))}
                  />
                  <Label htmlFor="translate">Translate to English</Label>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id="autocopy"
                    checked={settings.autoCopy}
                    onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, autoCopy: checked }))}
                  />
                  <Label htmlFor="autocopy">Auto-copy transcript</Label>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">App data: <code>{appDataDir}</code></p>
              <div>
                <Button onClick={() => void saveSettings()}>Save settings</Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
