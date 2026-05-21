import { useEffect, useMemo, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { Archive, Clock3, Download, FileJson2, FileSpreadsheet, History, Pin, Search, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api/tauri";
import type { TranscriptionHistoryStats, TranscriptionRecord } from "@/lib/types/history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
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
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "import" | "export-json" | "export-csv" | "export-zip" | "delete" | "restore" | "pin" | "save-edit" | "copy" | null
  >(null);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  useEffect(() => {
    setEditingText(selected?.cleanedText ?? "");
  }, [selected?.id]);

  async function load(reset = true) {
    setIsLoading(true);
    setLoadError(null);
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
      setLoadError("We couldn't load history right now.");
      toastError(error, "Failed to load history");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load(true);
  }, [includeDeleted]);

  async function onTogglePin(item: TranscriptionRecord) {
    if (pendingAction) return;
    setPendingAction("pin");
    try {
      await api.updateTranscription(item.id, { pinned: !item.pinned });
      toastSuccess(item.pinned ? "Removed pin" : "Pinned entry");
      await load(true);
    } catch (error) {
      toastError(error, "Failed to update pin");
    } finally {
      setPendingAction(null);
    }
  }

  async function onDelete(item: TranscriptionRecord) {
    if (pendingAction) return;
    setPendingAction("delete");
    try {
      await api.deleteTranscription(item.id, false);
      toastSuccess("Entry moved to deleted");
      await load(true);
    } catch (error) {
      toastError(error, "Failed to move entry to deleted");
    } finally {
      setPendingAction(null);
    }
  }

  async function onRestore(item: TranscriptionRecord) {
    if (pendingAction) return;
    setPendingAction("restore");
    try {
      await api.restoreTranscription(item.id);
      toastSuccess("Entry restored");
      await load(true);
    } catch (error) {
      toastError(error, "Failed to restore entry");
    } finally {
      setPendingAction(null);
    }
  }

  async function onCopyCleaned(item: TranscriptionRecord) {
    if (pendingAction) return;
    setPendingAction("copy");
    try {
      await navigator.clipboard.writeText(item.cleanedText);
      toastSuccess("Cleaned text copied");
    } catch (error) {
      toastError(error, "Failed to copy cleaned text");
    } finally {
      setPendingAction(null);
    }
  }

  async function onSaveEdit(item: TranscriptionRecord) {
    if (pendingAction || editingText === item.cleanedText) return;
    setPendingAction("save-edit");
    try {
      await api.updateTranscription(item.id, { cleanedText: editingText });
      toastSuccess("Edits saved");
      await load(true);
    } catch (error) {
      toastError(error, "Failed to save edits");
    } finally {
      setPendingAction(null);
    }
  }

  async function onExportJson() {
    if (pendingAction || !isTauriRuntime) return;
    setPendingAction("export-json");
    try {
      const payload = await api.exportTranscriptions(true);
      const target = await save({
        title: "Export transcription history",
        defaultPath: "murmur-transcriptions.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!target) return;
      await writeTextFile(target, payload);
      toastSuccess("JSON export complete");
    } catch (error) {
      toastError(error, "JSON export failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function onExportCsv() {
    if (pendingAction || !isTauriRuntime) return;
    setPendingAction("export-csv");
    try {
      const payload = await api.exportTranscriptionsCsv(true);
      const target = await save({
        title: "Export transcription history CSV",
        defaultPath: "murmur-transcriptions.csv",
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!target) return;
      await writeTextFile(target, payload);
      toastSuccess("CSV export complete");
    } catch (error) {
      toastError(error, "CSV export failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function onImport() {
    if (pendingAction || !isTauriRuntime) return;
    setPendingAction("import");
    try {
      const file = await open({
        title: "Import transcription history",
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!file || Array.isArray(file)) return;
      const payload = await readTextFile(file);
      const report = await api.importTranscriptions(payload);
      const title = report.failed > 0 ? "Import completed with issues" : "Import completed";
      const detail = `${report.imported} imported, ${report.skipped} skipped, ${report.failed} failed.`;
      if (report.failed > 0) {
        toastWarning(title, report.errors[0] ?? detail);
      } else {
        toastSuccess(title, detail);
      }
      await load(true);
    } catch (error) {
      toastError(error, "Import failed");
    } finally {
      setPendingAction(null);
    }
  }

  async function onExportZipBundle() {
    if (pendingAction || !isTauriRuntime) return;
    setPendingAction("export-zip");
    try {
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
          "ZIP export completed with missing audio",
          `${bundle.audioMissing} audio files are missing. Included ${bundle.audioIncluded} of ${bundle.audioReferenced} referenced files.`,
        );
      } else {
        toastSuccess(
          "ZIP export complete",
          `Included ${bundle.audioIncluded} audio files across ${bundle.totalEntries} entries.`,
        );
      }
    } catch (error) {
      toastError(error, "ZIP export failed");
    } finally {
      setPendingAction(null);
    }
  }

  const hasUnsavedEdit = Boolean(selected) && editingText !== (selected?.cleanedText ?? "");
  const isBusy = pendingAction !== null;
  const isFsActionUnavailable = !isTauriRuntime;
  const isSearchNoMatch = Boolean(query.trim()) && items.length === 0 && !isLoading && !loadError;
  const operationStatus = pendingAction ? `Running ${pendingAction} operation.` : "";
  const listStatus = isLoading ? "Loading history entries." : `Showing ${items.length} history entries.`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-2xl md:text-3xl">
            <History className="size-5" />
            Transcription History
          </CardTitle>
          <CardDescription>Review, search, and manage saved transcription sessions.</CardDescription>
        </CardHeader>
      </Card>

      <p className="sr-only" role="status" aria-live="polite">
        {operationStatus}
      </p>

      <section className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="overflow-hidden" aria-busy={isLoading}>
        <CardHeader className="pb-3">
          <CardTitle>History Library</CardTitle>
          <CardDescription>Search, filter, import, and export saved transcription sessions.</CardDescription>
          <CardAction>
            <Badge variant="outline">Avg ms: {Math.round(stats?.avgDurationMs ?? 0)}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex h-[calc(100vh-15rem)] flex-col gap-3">
          {isLoading && !stats ? (
            <div className="grid grid-cols-2 gap-2" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={`stats-skeleton-${index}`} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Badge variant="outline" className="justify-start">Total: {stats?.totalCount ?? 0}</Badge>
              <Badge variant="outline" className="justify-start">Pinned: {stats?.pinnedCount ?? 0}</Badge>
              <Badge variant="outline" className="justify-start">Deleted: {stats?.deletedCount ?? 0}</Badge>
              <Badge variant="outline" className="justify-start">Avg ms: {Math.round(stats?.avgDurationMs ?? 0)}</Badge>
            </div>
          )}

          <div className="flex gap-2">
            <Input
              aria-label="Search transcript text"
              placeholder="Search transcript text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void load(true);
              }}
            />
            <Button onClick={() => void load(true)} disabled={isLoading || isBusy}>
              {isLoading ? <Spinner /> : <Search data-icon="inline-start" />}
              {isLoading ? "Searching..." : "Search"}
            </Button>
          </div>

          <Button
            variant={includeDeleted ? "secondary" : "outline"}
            onClick={() => setIncludeDeleted((current) => !current)}
            disabled={isBusy}
          >
            {includeDeleted ? "Showing deleted entries" : "Show deleted entries"}
          </Button>

          {!isTauriRuntime ? (
            <p className="text-xs text-muted-foreground">
              Import/export is available in the desktop app. In web preview, file system actions are disabled.
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <div className="overflow-x-auto pb-1">
              <ButtonGroup className="min-w-max">
              <Button
                variant="outline"
                onClick={() => void onExportJson()}
                disabled={items.length === 0 || isBusy || isFsActionUnavailable}
                title={isFsActionUnavailable ? "Available in desktop app only." : "Export all visible history data as JSON."}
                aria-label="Export history as JSON"
              >
                {pendingAction === "export-json" ? <Spinner /> : <FileJson2 data-icon="inline-start" />}
                JSON
              </Button>
              <Button
                variant="outline"
                onClick={() => void onExportCsv()}
                disabled={items.length === 0 || isBusy || isFsActionUnavailable}
                title={isFsActionUnavailable ? "Available in desktop app only." : "Export tabular history for spreadsheets."}
                aria-label="Export history as CSV"
              >
                {pendingAction === "export-csv" ? <Spinner /> : <FileSpreadsheet data-icon="inline-start" />}
                CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => void onExportZipBundle()}
                disabled={items.length === 0 || isBusy || isFsActionUnavailable}
                title={
                  isFsActionUnavailable
                    ? "Available in desktop app only."
                    : "Export history + CSV + only audio files that still exist."
                }
                aria-label="Export history bundle as ZIP"
              >
                {pendingAction === "export-zip" ? <Spinner /> : <Archive data-icon="inline-start" />}
                ZIP
              </Button>
              </ButtonGroup>
            </div>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => void onImport()}
              disabled={isBusy || isFsActionUnavailable}
              title={isFsActionUnavailable ? "Available in desktop app only." : "Import transcription history from a JSON export."}
              aria-label="Import history from JSON"
            >
              {pendingAction === "import" ? <Spinner /> : <Upload data-icon="inline-start" />}
              Import
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            ZIP includes `history.csv`, `audio-manifest.csv`, and only referenced audio files that still exist on disk.
          </p>

          <Separator />

          <p className="sr-only" role="status" aria-live="polite">
            {listStatus}
          </p>
          <ScrollArea className="min-h-0 flex-1 pr-2">
            <div className="flex flex-col gap-2" role="listbox" aria-label="History entries">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  onKeyDown={(event) => {
                    if (!items.length) return;
                    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                    event.preventDefault();
                    const currentIndex = items.findIndex((candidate) => candidate.id === item.id);
                    const nextIndex =
                      event.key === "ArrowDown"
                        ? Math.min(items.length - 1, currentIndex + 1)
                        : Math.max(0, currentIndex - 1);
                    setSelectedId(items[nextIndex]?.id ?? item.id);
                  }}
                  className={`w-full rounded-xl border p-3 text-left transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected?.id === item.id ? "border-primary bg-muted/50" : ""}`}
                  role="option"
                  aria-selected={selected?.id === item.id}
                  aria-label={`Open history entry ${item.modelId} created ${formatDate(item.createdAt)}`}
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
              {loadError ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Archive />
                    </EmptyMedia>
                    <EmptyTitle>Couldn't load history</EmptyTitle>
                    <EmptyDescription>{loadError}</EmptyDescription>
                    <Button variant="outline" onClick={() => void load(true)} disabled={isLoading}>
                      {isLoading ? <Spinner /> : null}
                      Retry
                    </Button>
                  </EmptyHeader>
                </Empty>
              ) : null}
              {!items.length && !loadError && !isSearchNoMatch ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Archive />
                    </EmptyMedia>
                    <EmptyTitle>No history entries yet</EmptyTitle>
                    <EmptyDescription>Completed transcriptions will appear here for review and export.</EmptyDescription>
                    <Button
                      variant="outline"
                      onClick={() => void onImport()}
                      disabled={isBusy || isFsActionUnavailable}
                      title={isFsActionUnavailable ? "Available in desktop app only." : "Import history from JSON."}
                    >
                      <Upload data-icon="inline-start" />
                      Import JSON
                    </Button>
                  </EmptyHeader>
                </Empty>
              ) : null}
              {isSearchNoMatch ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Search />
                    </EmptyMedia>
                    <EmptyTitle>No matches found</EmptyTitle>
                    <EmptyDescription>Try another term or clear the search to view all history entries.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}
              {isLoading && items.length === 0 ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={`history-skeleton-${index}`} className="space-y-2 rounded-xl border p-3">
                      <Skeleton className="h-4 w-2/5" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </CardContent>
        <CardFooter className="justify-between">
          <p className="text-xs text-muted-foreground">Showing {items.length} entries{hasMore ? " (more available)" : ""}.</p>
          {hasMore ? (
            <Button variant="outline" onClick={() => void load(false)} disabled={isLoading || isBusy}>
              {isLoading ? <Spinner /> : <Download data-icon="inline-start" />}
              {isLoading ? "Loading..." : "Load more"}
            </Button>
          ) : null}
        </CardFooter>
      </Card>

      <Card className="overflow-hidden" aria-busy={isLoading && !selected}>
        <CardHeader className="pb-3">
          <CardTitle>Entry Inspector</CardTitle>
          <CardDescription>Review and edit cleaned text before reusing it.</CardDescription>
          <CardAction>
            {selected ? <Badge variant="outline">{selected.sourceType}</Badge> : <Badge variant="outline">No selection</Badge>}
          </CardAction>
        </CardHeader>
        <CardContent className="h-[calc(100vh-15rem)]">
          {!selected && isLoading ? (
            <div className="space-y-4 p-2" aria-hidden="true">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !selected ? (
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-xl font-semibold">{selected.modelId}</h2>
                    <p className="text-xs text-muted-foreground">
                      Created {formatDate(selected.createdAt)} | Source {selected.sourceType}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => void onCopyCleaned(selected)} disabled={isBusy}>
                      Copy cleaned text
                    </Button>
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => void onTogglePin(selected)} disabled={isBusy}>
                      {selected.pinned ? "Unpin" : "Pin"}
                    </Button>
                    {selected.deletedAt ? (
                      <Button variant="secondary" className="w-full sm:w-auto" onClick={() => void onRestore(selected)} disabled={isBusy}>
                        Restore
                      </Button>
                    ) : (
                      <Button variant="destructive" className="w-full sm:w-auto" onClick={() => void onDelete(selected)} disabled={isBusy}>
                        {pendingAction === "delete" ? <Spinner /> : <Trash2 data-icon="inline-start" />}
                        {pendingAction === "delete" ? "Deleting..." : "Delete"}
                      </Button>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Cleaned text (editable)</p>
                  <Textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} className="min-h-48" />
                  <Button
                    className="w-fit"
                    onClick={() => void onSaveEdit(selected)}
                    disabled={!hasUnsavedEdit || isBusy}
                    aria-label="Save cleaned text edits"
                  >
                    {pendingAction === "save-edit" ? <Spinner /> : null}
                    {pendingAction === "save-edit" ? "Saving..." : "Save edits"}
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Raw text</p>
                  <Textarea readOnly value={selected.rawText} className="min-h-40" />
                </div>
              </div>
            </ScrollArea>
          )}
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground">
            {selected ? `Selected entry created ${formatDate(selected.createdAt)}.` : "Pick a history entry to inspect and edit."}
          </p>
        </CardFooter>
      </Card>
      </section>
    </div>
  );
}
