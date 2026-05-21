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
import "./styles.css";

let models: ModelInfo[] = [];
let installed: InstalledModel[] = [];
let settings: AppSettings = {
  defaultModelId: "small",
  language: "auto",
  translate: false,
  autoCopy: false,
  audioInputDeviceId: null,
};
let transcript = "";
let status = "idle";
let appDataDir = "";
let activeTab: "home" | "models" | "settings" = "home";
let isRecording = false;
let liveMode = true;
let liveTimer: number | null = null;
let liveInFlight = false;
let activeTranscriptionTaskId: string | null = null;
const downloadProgress = new Map<string, DownloadProgressEvent>();
let backendAudioInputs: AudioInputDevice[] = [];
let browserAudioInputs: Array<{ id: string; label: string }> = [];

let stream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;
const chunks: Float32Array[] = [];

function installedMap() {
  return new Map(installed.map((m) => [m.id, m]));
}
function setStatus(next: string) {
  status = next;
  render();
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

async function refreshBrowserAudioInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  browserAudioInputs = devices
    .filter((d) => d.kind === "audioinput")
    .map((d) => ({ id: d.deviceId, label: d.label || "Microphone" }));

  if (!settings.audioInputDeviceId && browserAudioInputs.length > 0) {
    settings.audioInputDeviceId = browserAudioInputs[0].id;
  }
}

async function startRecording() {
  if (isRecording) return;
  const constraints: MediaStreamConstraints = settings.audioInputDeviceId
    ? {
        audio: {
          deviceId: { exact: settings.audioInputDeviceId },
        },
      }
    : { audio: true };

  stream = await navigator.mediaDevices.getUserMedia(constraints);
  await refreshBrowserAudioInputs();

  audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);
  processor = audioCtx.createScriptProcessor(4096, 1, 1);
  chunks.length = 0;
  processor.onaudioprocess = (e) => {
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };
  source.connect(processor);
  processor.connect(audioCtx.destination);
  isRecording = true;

  if (liveMode) {
    liveTimer = window.setInterval(async () => {
      if (!audioCtx || liveInFlight) return;
      const total = chunks.reduce((n, c) => n + c.length, 0);
      if (total < audioCtx.sampleRate) return;
      const merged = new Float32Array(total);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.length;
      }

      try {
        liveInFlight = true;
        const result = await api.transcribePcm(Array.from(merged), audioCtx.sampleRate, {
          modelId: settings.defaultModelId,
          language: settings.language === "auto" ? null : settings.language,
          translate: settings.translate,
        });
        if (result.text.trim().length > 0) {
          transcript = result.text;
          render();
        }
      } catch {
        // Keep recording even if an intermediate chunk fails.
      } finally {
        liveInFlight = false;
      }
    }, 2000);
  }

  setStatus("recording");
}

async function stopRecordingAndTranscribe() {
  if (!isRecording || !audioCtx) return;
  if (liveTimer) {
    window.clearInterval(liveTimer);
    liveTimer = null;
  }
  processor?.disconnect();
  stream?.getTracks().forEach((t) => t.stop());
  await audioCtx.close();

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  const wav = encodeWav(merged, audioCtx.sampleRate);
  await mkdir("recordings", { baseDir: BaseDirectory.AppData, recursive: true });
  const stamp = Date.now();
  const fileName = `recordings/recording-${stamp}.wav`;
  await writeFile(fileName, wav, { baseDir: BaseDirectory.AppData });

  isRecording = false;
  setStatus("transcribing");
  const fullPath = `${appDataDir}/recordings/recording-${stamp}.wav`;
  const result = await api.transcribeRecording(fullPath, {
    modelId: settings.defaultModelId,
    language: settings.language === "auto" ? null : settings.language,
    translate: settings.translate,
  });
  transcript = result.text;
  if (settings.autoCopy && transcript) await writeText(transcript);
  setStatus("done");
}

async function startFileTranscription() {
  const file = await open({ multiple: false });
  if (!file || Array.isArray(file)) return;
  const task = await api.startTranscriptionFile(file, {
    modelId: settings.defaultModelId,
    language: settings.language === "auto" ? null : settings.language,
    translate: settings.translate,
  });
  activeTranscriptionTaskId = task.taskId;
  setStatus("transcription queued");
}

function render() {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (!root) return;
  const installedById = installedMap();

  root.innerHTML = `
<header><h1>Whisper Local STT</h1><nav>
<button data-tab="home" class="${activeTab === "home" ? "active" : ""}">Home</button>
<button data-tab="models" class="${activeTab === "models" ? "active" : ""}">Models</button>
<button data-tab="settings" class="${activeTab === "settings" ? "active" : ""}">Settings</button>
</nav></header>
<main>
${
  activeTab === "home"
    ? `<section><div class="badge">Model: ${settings.defaultModelId}</div><div class="status">Status: ${status}</div><div class="controls"><button id="record-btn">${isRecording ? "Stop & Transcribe" : "Start Recording"}</button><label><input id="live-mode" type="checkbox" ${liveMode ? "checked" : ""} ${isRecording ? "disabled" : ""}/> Live transcription</label><button id="pick-file" ${activeTranscriptionTaskId ? "disabled" : ""}>Import WAV</button>${
        activeTranscriptionTaskId
          ? `<button id="cancel-transcription">Cancel Transcription</button>`
          : ""
      }<button id="copy-text">Copy</button><button id="clear-text">Clear</button></div><textarea rows="16">${transcript}</textarea></section>`
    : ""
}
${
  activeTab === "models"
    ? `<section><p>Download once from Hugging Face, then run offline.</p><div class="model-grid">${models
        .map((m) => {
          const i = installedById.get(m.id);
          const d = Array.from(downloadProgress.values()).find((x) => x.modelId === m.id);
          return `<article class="card"><h3>${m.name} ${
            m.recommended ? '<span class="pill">Recommended</span>' : ""
          }</h3><p>${m.description}</p><p><code>${m.id}</code></p><p>${
            i?.installed ? "Installed" : "Not installed"
          }</p>${d ? `<progress max="100" value="${d.progressPct ?? 0}"></progress>` : ""}<div class="actions"><button data-download="${m.id}">${
            i?.installed ? "Re-download" : "Download"
          }</button><button data-delete="${m.id}" ${i?.installed ? "" : "disabled"}>Delete</button></div></article>`;
        })
        .join("")}</div></section>`
    : ""
}
${
  activeTab === "settings"
    ? `<section><label>Default model <select id="default-model">${models
        .map(
          (m) =>
            `<option value="${m.id}" ${settings.defaultModelId === m.id ? "selected" : ""}>${m.name}</option>`,
        )
        .join("")}</select></label><label>Language <input id="language" value="${settings.language}" /></label><label>Audio input device <select id="audio-input-device">${browserAudioInputs
        .map(
          (d) =>
            `<option value="${d.id}" ${settings.audioInputDeviceId === d.id ? "selected" : ""}>${d.label}</option>`,
        )
        .join("")}</select></label><p class="muted">Detected by browser: ${browserAudioInputs.length} • Detected by backend: ${backendAudioInputs.length}</p><label><input id="translate" type="checkbox" ${
        settings.translate ? "checked" : ""
      }/> Translate to English</label><label><input id="autocopy" type="checkbox" ${
        settings.autoCopy ? "checked" : ""
      }/> Auto-copy transcript</label><p>App data: <code>${appDataDir}</code></p><button id="save-settings">Save settings</button></section>`
    : ""
}
</main>`;

  root.querySelectorAll("nav button").forEach((el) =>
    el.addEventListener("click", () => {
      activeTab = (el as HTMLButtonElement).dataset.tab as typeof activeTab;
      render();
    }),
  );

  root.querySelector("#record-btn")?.addEventListener("click", async () => {
    try {
      if (isRecording) await stopRecordingAndTranscribe();
      else await startRecording();
    } catch (e) {
      setStatus(`error: ${String(e)}`);
    }
  });

  root.querySelector("#live-mode")?.addEventListener("change", (e) => {
    const input = e.target as HTMLInputElement;
    liveMode = input.checked;
  });

  root.querySelector("#pick-file")?.addEventListener("click", async () => {
    try {
      await startFileTranscription();
    } catch (e) {
      setStatus(`error: ${String(e)}`);
    }
  });

  root.querySelector("#cancel-transcription")?.addEventListener("click", async () => {
    if (!activeTranscriptionTaskId) return;
    await api.cancelTranscription(activeTranscriptionTaskId);
    setStatus("cancel requested");
  });

  root.querySelector("#copy-text")?.addEventListener("click", async () => writeText(transcript));
  root.querySelector("#clear-text")?.addEventListener("click", () => {
    transcript = "";
    render();
  });

  root.querySelectorAll("[data-download]").forEach((el) =>
    el.addEventListener("click", async () => {
      await api.downloadModel((el as HTMLButtonElement).dataset.download!);
    }),
  );
  root.querySelectorAll("[data-delete]").forEach((el) =>
    el.addEventListener("click", async () => {
      await api.deleteModel((el as HTMLButtonElement).dataset.delete!);
      installed = await api.getInstalledModels();
      render();
    }),
  );

  root.querySelector("#save-settings")?.addEventListener("click", async () => {
    settings = {
      defaultModelId:
        (root.querySelector("#default-model") as HTMLSelectElement)?.value ?? settings.defaultModelId,
      language: (root.querySelector("#language") as HTMLInputElement)?.value ?? "auto",
      audioInputDeviceId:
        (root.querySelector("#audio-input-device") as HTMLSelectElement)?.value || null,
      translate: (root.querySelector("#translate") as HTMLInputElement)?.checked ?? false,
      autoCopy: (root.querySelector("#autocopy") as HTMLInputElement)?.checked ?? false,
    };
    await api.saveSettings(settings);
    setStatus("settings saved");
  });
}

async function bootstrap() {
  models = await api.listModels();
  installed = await api.getInstalledModels();
  settings = await api.getSettings();
  appDataDir = await api.getAppDataDir();
  backendAudioInputs = await api.getAudioInputs();

  // Request permission once so browser device labels are available.
  try {
    const permissionStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    permissionStream.getTracks().forEach((t) => t.stop());
  } catch {
    // Device labels may remain hidden until user grants permission during recording.
  }
  await refreshBrowserAudioInputs();

  await listen<DownloadProgressEvent>("model-download-progress", (event) => {
    downloadProgress.set(event.payload.taskId, event.payload);
    render();
  });
  await listen<{ taskId: string; modelId: string }>("model-download-complete", async (event) => {
    downloadProgress.delete(event.payload.taskId);
    installed = await api.getInstalledModels();
    setStatus(`model ${event.payload.modelId} installed`);
  });
  await listen<{ taskId: string; modelId: string; error: string }>("model-download-error", (event) => {
    downloadProgress.delete(event.payload.taskId);
    setStatus(`download error (${event.payload.modelId}): ${event.payload.error}`);
  });

  await listen<{ taskId: string; stage: string; message: string }>(
    "transcription-progress",
    (event) => {
      if (activeTranscriptionTaskId === event.payload.taskId) {
        setStatus(`${event.payload.stage}: ${event.payload.message}`);
      }
    },
  );

  await listen<{ taskId: string; result: TranscriptionResult }>("transcription-complete", async (event) => {
    if (activeTranscriptionTaskId !== event.payload.taskId) return;
    transcript = event.payload.result.text;
    if (settings.autoCopy && transcript) await writeText(transcript);
    activeTranscriptionTaskId = null;
    setStatus("done");
  });

  await listen<{ taskId: string; error: string }>("transcription-error", (event) => {
    if (activeTranscriptionTaskId !== event.payload.taskId) return;
    activeTranscriptionTaskId = null;
    setStatus(`transcription error: ${event.payload.error}`);
  });

  await listen<{ taskId: string }>("transcription-canceled", (event) => {
    if (activeTranscriptionTaskId !== event.payload.taskId) return;
    activeTranscriptionTaskId = null;
    setStatus("transcription canceled");
  });

  render();
}

bootstrap().catch((err) => {
  const root = document.querySelector<HTMLDivElement>("#app");
  if (root) root.innerHTML = `<pre>Bootstrap failed: ${String(err)}</pre>`;
});
