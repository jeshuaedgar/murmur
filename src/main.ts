import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { BaseDirectory, mkdir, writeFile } from "@tauri-apps/plugin-fs";
import { api } from "./lib/api/tauri";
import type { AppSettings } from "./lib/types/settings";
import type { DownloadProgressEvent, InstalledModel, ModelInfo } from "./lib/types/models";
import "./styles.css";

let models: ModelInfo[] = [];
let installed: InstalledModel[] = [];
let settings: AppSettings = { defaultModelId: "small", language: "auto", translate: false, autoCopy: false };
let transcript = "";
let status = "idle";
let appDataDir = "";
let activeTab: "home" | "models" | "settings" = "home";
let isRecording = false;
const downloadProgress = new Map<string, DownloadProgressEvent>();

let stream: MediaStream | null = null;
let audioCtx: AudioContext | null = null;
let processor: ScriptProcessorNode | null = null;
const chunks: Float32Array[] = [];

function installedMap() { return new Map(installed.map((m) => [m.id, m])); }
function setStatus(next: string) { status = next; render(); }

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let off = 0;
  const writeString = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off++, s.charCodeAt(i)); };
  writeString("RIFF"); view.setUint32(off, 36 + dataSize, true); off += 4;
  writeString("WAVE"); writeString("fmt ");
  view.setUint32(off, 16, true); off += 4;
  view.setUint16(off, 1, true); off += 2;
  view.setUint16(off, 1, true); off += 2;
  view.setUint32(off, sampleRate, true); off += 4;
  view.setUint32(off, byteRate, true); off += 4;
  view.setUint16(off, blockAlign, true); off += 2;
  view.setUint16(off, 16, true); off += 2;
  writeString("data"); view.setUint32(off, dataSize, true); off += 4;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Uint8Array(buffer);
}

async function startRecording() {
  if (isRecording) return;
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
  setStatus("recording");
}

async function stopRecordingAndTranscribe() {
  if (!isRecording || !audioCtx) return;
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
  await mkdir("recordings", { baseDir: BaseDirectory.AppLocalData, recursive: true });
  const stamp = Date.now();
  const fileName = `recordings/recording-${stamp}.wav`;
  await writeFile(fileName, wav, { baseDir: BaseDirectory.AppLocalData });

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
${activeTab === "home" ? `<section><div class="badge">Model: ${settings.defaultModelId}</div><div class="status">Status: ${status}</div><div class="controls"><button id="record-btn">${isRecording ? "Stop & Transcribe" : "Start Recording"}</button><button id="pick-file">Import WAV</button><button id="copy-text">Copy</button><button id="clear-text">Clear</button></div><textarea rows="16">${transcript}</textarea></section>` : ""}
${activeTab === "models" ? `<section><p>Download once from Hugging Face, then run offline.</p><div class="model-grid">${models.map((m) => { const i = installedById.get(m.id); const d = Array.from(downloadProgress.values()).find((x) => x.modelId === m.id); return `<article class="card"><h3>${m.name} ${m.recommended ? '<span class="pill">Recommended</span>' : ""}</h3><p>${m.description}</p><p><code>${m.id}</code></p><p>${i?.installed ? "Installed" : "Not installed"}</p>${d ? `<progress max="100" value="${d.progressPct ?? 0}"></progress>` : ""}<div class="actions"><button data-download="${m.id}">${i?.installed ? "Re-download" : "Download"}</button><button data-delete="${m.id}" ${i?.installed ? "" : "disabled"}>Delete</button></div></article>`; }).join("")}</div></section>` : ""}
${activeTab === "settings" ? `<section><label>Default model <select id="default-model">${models.map((m) => `<option value="${m.id}" ${settings.defaultModelId === m.id ? "selected" : ""}>${m.name}</option>`).join("")}</select></label><label>Language <input id="language" value="${settings.language}" /></label><label><input id="translate" type="checkbox" ${settings.translate ? "checked" : ""}/> Translate to English</label><label><input id="autocopy" type="checkbox" ${settings.autoCopy ? "checked" : ""}/> Auto-copy transcript</label><p>App data: <code>${appDataDir}</code></p><button id="save-settings">Save settings</button></section>` : ""}
</main>`;

  root.querySelectorAll("nav button").forEach((el) => el.addEventListener("click", () => { activeTab = (el as HTMLButtonElement).dataset.tab as typeof activeTab; render(); }));
  root.querySelector("#record-btn")?.addEventListener("click", async () => { try { if (isRecording) await stopRecordingAndTranscribe(); else await startRecording(); } catch (e) { setStatus(`error: ${String(e)}`); } });
  root.querySelector("#pick-file")?.addEventListener("click", async () => { try { const file = await open({ multiple: false }); if (!file || Array.isArray(file)) return; setStatus("transcribing"); const result = await api.transcribeFile(file, { modelId: settings.defaultModelId, language: settings.language === "auto" ? null : settings.language, translate: settings.translate }); transcript = result.text; if (settings.autoCopy && transcript) await writeText(transcript); setStatus("done"); render(); } catch (e) { setStatus(`error: ${String(e)}`); } });
  root.querySelector("#copy-text")?.addEventListener("click", async () => writeText(transcript));
  root.querySelector("#clear-text")?.addEventListener("click", () => { transcript = ""; render(); });
  root.querySelectorAll("[data-download]").forEach((el) => el.addEventListener("click", async () => { await api.downloadModel((el as HTMLButtonElement).dataset.download!); }));
  root.querySelectorAll("[data-delete]").forEach((el) => el.addEventListener("click", async () => { await api.deleteModel((el as HTMLButtonElement).dataset.delete!); installed = await api.getInstalledModels(); render(); }));
  root.querySelector("#save-settings")?.addEventListener("click", async () => {
    settings = {
      defaultModelId: (root.querySelector("#default-model") as HTMLSelectElement)?.value ?? settings.defaultModelId,
      language: (root.querySelector("#language") as HTMLInputElement)?.value ?? "auto",
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

  await listen<DownloadProgressEvent>("model-download-progress", (event) => { downloadProgress.set(event.payload.taskId, event.payload); render(); });
  await listen<{ taskId: string; modelId: string }>("model-download-complete", async (event) => { downloadProgress.delete(event.payload.taskId); installed = await api.getInstalledModels(); setStatus(`model ${event.payload.modelId} installed`); });
  await listen<{ taskId: string; modelId: string; error: string }>("model-download-error", (event) => { downloadProgress.delete(event.payload.taskId); setStatus(`download error (${event.payload.modelId}): ${event.payload.error}`); });

  render();
}
bootstrap().catch((err) => { const root = document.querySelector<HTMLDivElement>("#app"); if (root) root.innerHTML = `<pre>Bootstrap failed: ${String(err)}</pre>`; });
