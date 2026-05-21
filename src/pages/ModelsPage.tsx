import { useEffect, useMemo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Boxes, Brain, Download, FlaskConical, InfoIcon, RefreshCcw, Trash2, WandSparkles } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useAppState } from "@/context/app-state";
import { useModelConnectivity } from "@/features/models/hooks/use-model-connectivity";
import { useModelActions } from "@/features/models/lib/model-actions";
import { groupModelsByLab } from "@/features/models/lib/lab-order";
import { getModelCardState, getModelProgressByModelId } from "@/features/models/lib/model-view-state";
import { ModelSectionCard } from "@/features/models/components/model-section-card";
import { api } from "@/lib/api/tauri";
import { toastSuccess } from "@/lib/toast";

function formatBytes(bytes?: number) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return "Unknown";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

export function ModelsPage() {
  const { models, installedById, downloadProgress, downloadModel, deleteModel } = useAppState();
  const progressByModelId = useMemo(() => getModelProgressByModelId(downloadProgress), [downloadProgress]);
  const modelsByLab = useMemo(() => groupModelsByLab(models), [models]);
  const {
    connectivityStatus,
    connectivityDetail,
    checkConnectivity,
    cacheDiagnostics,
    refreshCacheDiagnostics,
  } = useModelConnectivity();
  const {
    pendingRemoveModelId,
    pendingModel,
    pendingRedownloadModelId,
    pendingRedownloadModel,
    openRemoveConfirmation,
    closeRemoveConfirmation,
    confirmRemove,
    closeRedownloadConfirmation,
    confirmRedownload,
    handleDownload,
  } = useModelActions({
    models,
    downloadModel,
    deleteModel,
    checkConnectivity,
  });

  const totalModels = models.length;
  const installedModels = models.filter((model) => installedById.get(model.id)?.installed).length;
  const activeDownloads = Array.from(downloadProgress.values()).filter((entry) => (entry.progressPct ?? 0) < 100).length;
  const cleanupModels = models.filter((model) => model.lab === "Cleanup Models");
  const installedCleanupModels = cleanupModels.filter((model) => installedById.get(model.id)?.installed).length;

  useEffect(() => {
    void refreshCacheDiagnostics();
  }, [refreshCacheDiagnostics]);

  return (
    <div className="space-y-8">
      <header className="space-y-5 rounded-xl border bg-card px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
              <Boxes className="size-5" />
              Model Library
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Browse model families, install once, and keep transcription fully offline.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{installedModels}/{totalModels} installed</Badge>
            {activeDownloads > 0 && <Badge variant="secondary">{activeDownloads} downloading</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            {connectivityStatus === "offline" && <Badge variant="destructive">No internet</Badge>}
            {connectivityStatus === "online" && <Badge variant="secondary">Online</Badge>}
            {connectivityStatus === "unknown" && <Badge variant="outline">Connectivity unknown</Badge>}
            {connectivityStatus === "checking" && (
              <Badge variant="outline" className="inline-flex items-center gap-1">
                <Spinner className="size-3" />
                Checking connectivity
              </Badge>
            )}
            {connectivityDetail ? <p className="text-sm text-muted-foreground">{connectivityDetail}</p> : null}
          </div>
          {cacheDiagnostics ? (
            <p className="text-xs text-muted-foreground">
              Cache: {cacheDiagnostics.status} | key {cacheDiagnostics.key} | ttl {Math.round(cacheDiagnostics.ttlMs / 60000)}m
              {typeof cacheDiagnostics.ageMs === "number" ? ` | age ${Math.round(cacheDiagnostics.ageMs / 1000)}s` : ""}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void api.invalidateModelCatalogCache().then(() => {
                  toastSuccess("Model catalog cache cleared");
                  void refreshCacheDiagnostics();
                });
              }}
            >
              Clear cache
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void api.listModels().then(() => {
                  toastSuccess("Catalog refresh requested");
                  void refreshCacheDiagnostics();
                });
              }}
            >
              Refresh catalog now
            </Button>
          </div>
        </div>
      </header>

      {modelsByLab.map(([lab, labModels]) => {
        if (lab === "Cleanup Models") {
          return null;
        }
        const LabIcon = lab === "OpenAI Whisper" ? Brain : FlaskConical;
        const installedCount = labModels.filter((model) => installedById.get(model.id)?.installed).length;
        return (
          <ModelSectionCard
            key={lab}
            icon={<LabIcon className="size-4" />}
            title={lab}
            countBadge={`${installedCount}/${labModels.length} installed`}
            preContent={
              lab === "Distil-Whisper" ? (
                <Alert>
                  <InfoIcon className="size-4" />
                  <AlertTitle>Distil-Whisper Guidance</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Default pick: <code>distil-large-v3</code> for most workloads.</li>
                      <li>Low-memory devices: <code>distil-small.en</code>.</li>
                      <li>Language support: English speech recognition only.</li>
                      <li>Status: Experimental in this app; results may vary by hardware and audio.</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : null
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {labModels.map((model) => {
                const installedModel = installedById.get(model.id);
                const progress = progressByModelId.get(model.id);
                const {
                  progressValue,
                  isInstalled,
                  isDownloading,
                  actionLabel,
                  statusLabel,
                  statusBadgeVariant,
                  installButtonVariant,
                } = getModelCardState({
                  installedModel,
                  progress,
                });

                return (
                  <Card key={model.id} className="h-full">
                    <CardHeader className="gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <CardTitle className="text-base">{model.name}</CardTitle>
                        <Badge variant="outline" className="font-mono">
                          {model.id} ({formatBytes(model.sizeBytes)})
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {model.recommended && <Badge variant="secondary">Recommended</Badge>}
                        {model.fastest && <Badge variant="outline">Optimized for speed</Badge>}
                        {model.bestQuality && <Badge variant="secondary">High accuracy</Badge>}
                      </div>
                      <CardDescription className="leading-relaxed">{model.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="flex-1 space-y-2">
                      {isDownloading && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="inline-flex items-center gap-1.5">
                              <Spinner className="size-3" />
                              Downloading model
                            </span>
                            <span>{Math.round(progressValue)}%</span>
                          </div>
                          <Progress value={progressValue} aria-label={`Download progress for ${model.name}`} />
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="mt-auto grid grid-cols-2 gap-2">
                      <Button
                        className="w-full"
                        variant={installButtonVariant}
                        disabled={isDownloading}
                        onClick={() => void handleDownload(model.id, isInstalled).catch(() => undefined)}
                      >
                        {isDownloading ? <Spinner /> : isInstalled ? <RefreshCcw /> : <Download />}
                        {isDownloading ? "Downloading..." : actionLabel}
                      </Button>
                      <Button
                        className="w-full"
                        variant="destructive"
                        disabled={!isInstalled || isDownloading}
                        onClick={() => openRemoveConfirmation(model.id)}
                      >
                        <Trash2 />
                        Remove model
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </ModelSectionCard>
        );
      })}

      <ModelSectionCard
        sectionId="cleanup-models"
        title="Cleanup Models"
        icon={<WandSparkles className="size-4" />}
        countBadge={`${installedCleanupModels}/${cleanupModels.length} installed`}
        preContent={
          <>
            <CardDescription>
              Optional models for transcript cleanup pipeline. These use a different backend than Whisper transcription.
            </CardDescription>
            <Alert>
              <InfoIcon className="size-4" />
              <AlertTitle>Different backend path</AlertTitle>
              <AlertDescription>
                Cleanup models are downloaded and managed here, but they are used by the cleanup backend pipeline, not by the Whisper transcription engine.
              </AlertDescription>
            </Alert>
          </>
        }
      >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {cleanupModels.map((model) => {
              const installedModel = installedById.get(model.id);
              const progress = progressByModelId.get(model.id);
              const {
                progressValue,
                isInstalled,
                isDownloading,
                actionLabel,
                statusLabel,
                statusBadgeVariant,
                installButtonVariant,
              } = getModelCardState({
                installedModel,
                progress,
              });
              return (
                <Card key={model.id} className="h-full">
                  <CardHeader className="gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base">{model.name}</CardTitle>
                      <Badge variant="outline" className="font-mono">
                        {model.id} ({formatBytes(model.sizeBytes)})
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
                    </div>
                    <CardDescription className="leading-relaxed">{model.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 space-y-2">
                    {isDownloading && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="inline-flex items-center gap-1.5">
                            <Spinner className="size-3" />
                            Downloading model
                          </span>
                          <span>{Math.round(progressValue)}%</span>
                        </div>
                        <Progress value={progressValue} aria-label={`Download progress for ${model.name}`} />
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="mt-auto grid grid-cols-2 gap-2">
                    <Button
                      className="w-full"
                      variant={installButtonVariant}
                      disabled={isDownloading}
                      onClick={() => void handleDownload(model.id, isInstalled).catch(() => undefined)}
                    >
                      {isDownloading ? <Spinner /> : isInstalled ? <RefreshCcw /> : <Download />}
                      {isDownloading ? "Downloading..." : actionLabel}
                    </Button>
                    <Button
                      className="w-full"
                      variant="destructive"
                      disabled={!isInstalled || isDownloading}
                      onClick={() => openRemoveConfirmation(model.id)}
                    >
                      <Trash2 />
                      Remove model
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
      </ModelSectionCard>

      <AlertDialog open={Boolean(pendingRemoveModelId)} onOpenChange={(open) => !open && closeRemoveConfirmation()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove local model?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete <strong>{pendingModel?.name ?? "this model"}</strong> from local storage. You can install it
              again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void confirmRemove()} disabled={!pendingModel}>
              Remove model
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingRedownloadModelId)}
        onOpenChange={(open) => !open && closeRedownloadConfirmation()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-download local model?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace <strong>{pendingRedownloadModel?.name ?? "this model"}</strong> with a fresh download.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="secondary" onClick={() => void confirmRedownload()} disabled={!pendingRedownloadModel}>
              Re-download model
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
