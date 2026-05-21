import { useEffect, useMemo, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { Archive, Clock3, Download, FileJson2, FileSpreadsheet, Pin, Search, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api/tauri";
import type { TranscriptionHistoryStats, TranscriptionRecord } from "@/lib/types/history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toastError, toastSuccess, toastWarning } from "@/lib/toast";
import { isTauriRuntime } from "@/lib/runtime/tauri";

const PAGE_SIZE = 50;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function HistoryPage() {
  const [items, setItems] = useState<TranscriptionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState<TranscriptionHistoryStats | null>(null);
  const [editingText, setEditingText] = useState("");

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  useEffect(() => {
    setEditingText(selected?.cleanedText ?? "");
  }, [selected?.id]);

  async function load(reset = true) {
    try {
      const nextOffset = reset ? 0 : offset;
      const next = await api.listTranscriptions({
        limit: PAGE_SIZE,
        offset: nextOffset,
        includeDeleted,
        query: query.trim() || undefined,
      });
      const merged = reset ? next : [...items, ...next];
      setItems(merged);
      setHasMore(next.length === PAGE_SIZE);
      setOffset(nextOffset + next.length);
      if (reset && next.length) {
        setSelectedId(next[0].id);
      }
      const nextStats = await api.getTranscriptionHistoryStats();
      setStats(nextStats);
    } catch (error) {
      toastError(error, "Failed to load history");
    }
  }

  useEffect(() => {
    void load(true);
  }, [includeDeleted]);

  async function onTogglePin(item: TranscriptionRecord) {
    await api.updateTranscription(item.id, { pinned: !item.pinned });
    await load(true);
  }

  async function onDelete(item: TranscriptionRecord) {
    await api.deleteTranscription(item.id, false);
    toastSuccess("Moved to deleted");
    await load(true);
  }

  async function onRestore(item: TranscriptionRecord) {
    await api.restoreTranscription(item.id);
    toastSuccess("Restored from deleted");
    await load(true);
  }

  async function onCopyCleaned(item: TranscriptionRecord) {
    await navigator.clipboard.writeText(item.cleanedText);
    toastSuccess("Copied cleaned text");
  }

  async function onSaveEdit(item: TranscriptionRecord) {
    await api.updateTranscription(item.id, { cleanedText: editingText });
    toastSuccess("Saved cleaned text edit");
    await load(true);
  }

  async function onExportJson() {
    try {
      const payload = await api.exportTranscriptions(true);
      if (isTauriRuntime) {
        const target = await save({
          title: "Export transcription history",
          defaultPath: "murmur-transcriptions.json",
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        if (!target) return;
        await writeTextFile(target, payload);
      } else {
        await navigator.clipboard.writeText(payload);
      }
      toastSuccess("JSON history exported");
    } catch (error) {
      toastError(error, "Failed to export history");
    }
  }

  async function onExportCsv() {
    try {
      const payload = await api.exportTranscriptionsCsv(true);
      if (isTauriRuntime) {
        const target = await save({
          title: "Export transcription history CSV",
          defaultPath: "murmur-transcriptions.csv",
          filters: [{ name: "CSV", extensions: ["csv"] }],
        });
        if (!target) return;
        await writeTextFile(target, payload);
      } else {
        await navigator.clipboard.writeText(payload);
      }
      toastSuccess("CSV history exported");
    } catch (error) {
      toastError(error, "Failed to export CSV history");
    }
  }

  async function onImport() {
    try {
      if (!isTauriRuntime) {
        toastError("Import requires Tauri runtime", "Not available in web preview");
        return;
      }
      const file = await open({
        title: "Import transcription history",
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!file || Array.isArray(file)) return;
      const payload = await readTextFile(file);
      const report = await api.importTranscriptions(payload);
      toastSuccess(
        `Imported ${report.imported}, failed ${report.failed}, skipped ${report.skipped}`,
        report.errors[0],
      );
      await load(true);
    } catch (error) {
      toastError(error, "Failed to import history");
    }
  }

  async function onExportZipBundle() {
    try {
      if (!isTauriRuntime) {
        toastError("ZIP export requires Tauri runtime", "Not available in web preview");
        return;
      }
      const bundle = await api.exportTranscriptionsBundleZip(true);
      const target = await save({
        title: "Export history + audio bundle",
        defaultPath: "murmur-history-bundle.zip",
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
      if (!target) return;
      await writeFile(target, new Uint8Array(bundle.bytes));
      if (bundle.audioMissing > 0) {
        toastWarning(
          "ZIP bundle exported with missing audio",
          `Included ${bundle.audioIncluded}/${bundle.audioReferenced} referenced audio files. Missing ${bundle.audioMissing}.`,
        );
      } else {
        toastSuccess(
          "ZIP history bundle exported",
          `Included ${bundle.audioIncluded} audio files across ${bundle.totalEntries} entries.`,
        );
      }
    } catch (error) {
      toastError(error, "Failed to export ZIP history bundle");
    }
  }

  return (
    <section className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle>History Library</CardTitle>
          <CardDescription>Search, filter, and export transcript sessions.</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[calc(100vh-15rem)] flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Badge variant="outline" className="justify-start">Total: {stats?.totalCount ?? 0}</Badge>
            <Badge variant="outline" className="justify-start">Pinned: {stats?.pinnedCount ?? 0}</Badge>
            <Badge variant="outline" className="justify-start">Deleted: {stats?.deletedCount ?? 0}</Badge>
            <Badge variant="outline" className="justify-start">Avg ms: {Math.round(stats?.avgDurationMs ?? 0)}</Badge>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Search transcript text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void load(true);
              }}
            />
            <Button onClick={() => void load(true)}>
              <Search data-icon="inline-start" />
              Search
            </Button>
          </div>

          <Button
            variant={includeDeleted ? "secondary" : "outline"}
            onClick={() => setIncludeDeleted((current) => !current)}
          >
            {includeDeleted ? "Showing deleted entries" : "Show deleted entries"}
          </Button>

          <div className="grid grid-cols-4 gap-2">
            <Button variant="outline" onClick={() => void onExportJson()} disabled={items.length === 0}>
              <FileJson2 data-icon="inline-start" />
              JSON
            </Button>
            <Button variant="outline" onClick={() => void onExportCsv()} disabled={items.length === 0}>
              <FileSpreadsheet data-icon="inline-start" />
              CSV
            </Button>
            <Button variant="outline" onClick={() => void onExportZipBundle()} disabled={items.length === 0}>
              <Archive data-icon="inline-start" />
              ZIP
            </Button>
            <Button variant="outline" onClick={() => void onImport()}>
              <Upload data-icon="inline-start" />
              Import
            </Button>
          </div>

          <Separator />

          <ScrollArea className="min-h-0 flex-1 pr-2">
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full rounded-xl border p-3 text-left transition hover:bg-muted/50 ${selected?.id === item.id ? "border-primary bg-muted/50" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{item.modelId}</p>
                    {item.pinned ? (
                      <Badge variant="secondary">
                        <Pin data-icon="inline-start" />
                        Pinned
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.cleanedText}</p>
                  <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="size-3" />
                    {formatDate(item.createdAt)}
                  </p>
                </button>
              ))}
              {!items.length ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Archive />
                    </EmptyMedia>
                    <EmptyTitle>No history entries yet</EmptyTitle>
                    <EmptyDescription>Completed transcriptions will appear here for review and export.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}
              {hasMore ? (
                <Button variant="outline" className="w-full" onClick={() => void load(false)}>
                  <Download data-icon="inline-start" />
                  Load more
                </Button>
              ) : null}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle>Entry Inspector</CardTitle>
          <CardDescription>Review and adjust cleaned text before reuse.</CardDescription>
        </CardHeader>
        <CardContent className="h-[calc(100vh-15rem)]">
          {!selected ? (
            <Empty className="h-full border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>Select a transcription</EmptyTitle>
                <EmptyDescription>Choose any session from the left panel to inspect full raw and cleaned text.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ScrollArea className="h-full pr-2">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-semibold">{selected.modelId}</h2>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(selected.createdAt)} | Source {selected.sourceType}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void onCopyCleaned(selected)}>
                      Copy cleaned text
                    </Button>
                    <Button variant="outline" onClick={() => void onTogglePin(selected)}>
                      {selected.pinned ? "Unpin" : "Pin"}
                    </Button>
                    {selected.deletedAt ? (
                      <Button variant="secondary" onClick={() => void onRestore(selected)}>
                        Restore
                      </Button>
                    ) : (
                      <Button variant="destructive" onClick={() => void onDelete(selected)}>
                        <Trash2 data-icon="inline-start" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Cleaned text (editable)</p>
                  <Textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} className="min-h-48" />
                  <Button className="w-fit" onClick={() => void onSaveEdit(selected)}>Save edits</Button>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Raw text</p>
                  <Textarea readOnly value={selected.rawText} className="min-h-40" />
                </div>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
