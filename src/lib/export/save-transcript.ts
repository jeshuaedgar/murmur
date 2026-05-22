import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import type { ExportFormat } from "@/lib/types/export";
import { isTauriRuntime } from "@/lib/runtime/tauri";

const EXT_BY_FORMAT: Record<ExportFormat, string> = {
  txt: "txt",
  md: "md",
  json: "json",
};

function buildDefaultFileName(format: ExportFormat): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `murmur-transcript-${stamp}.${EXT_BY_FORMAT[format]}`;
}

function triggerBrowserDownload(content: string, format: ExportFormat, fileName: string) {
  const mimeType = format === "json" ? "application/json" : "text/plain;charset=utf-8";
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type SaveTranscriptExportResult = {
  saved: boolean;
  targetPath?: string;
};

export async function saveTranscriptExport(content: string, format: ExportFormat): Promise<SaveTranscriptExportResult> {
  const defaultPath = buildDefaultFileName(format);

  if (!isTauriRuntime) {
    triggerBrowserDownload(content, format, defaultPath);
    return { saved: true, targetPath: defaultPath };
  }

  const filePath = await save({
    title: "Export transcript",
    defaultPath,
    filters: [{ name: format.toUpperCase(), extensions: [EXT_BY_FORMAT[format]] }],
  });

  if (!filePath) return { saved: false };

  await writeTextFile(filePath, content);
  return { saved: true, targetPath: filePath };
}
