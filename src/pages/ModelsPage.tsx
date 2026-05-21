import { useMemo } from "react";
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
import { Boxes, Brain, Download, FlaskConical, InfoIcon, RefreshCcw, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useAppState } from "@/context/app-state";
import { useModelConnectivity } from "@/features/models/hooks/use-model-connectivity";
import { useModelActions } from "@/features/models/lib/model-actions";
import { groupModelsByLab } from "@/features/models/lib/lab-order";
import { getModelCardState, getModelProgressByModelId } from "@/features/models/lib/model-view-state";

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
  const { connectivityStatus, connectivityDetail, checkConnectivity } = useModelConnectivity();
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
            {connectivityDetail ? <p className="text-sm text-muted-foreground">{connectivityDetail}</p> : null}
          </div>
        </div>
      </header>

      {modelsByLab.map(([lab, labModels]) => {
        const LabIcon = lab === "OpenAI Whisper" ? Brain : FlaskConical;
        const installedCount = labModels.filter((model) => installedById.get(model.id)?.installed).length;
        return (
          <Card key={lab}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <LabIcon className="size-4" />
                <CardTitle className="text-xl tracking-tight">{lab}</CardTitle>
                <Badge variant="secondary" className="ml-auto">
                  {installedCount}/{labModels.length} installed
                </Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-4 pt-6 pb-6">
            {lab === "Distil-Whisper" && (
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
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {labModels.map((model) => {
                const installedModel = installedById.get(model.id);
                const progress = progressByModelId.get(model.id);
                const {
                  progressValue,
                  hasProgress,
                  isInstalled,
                  isDownloading,
                  actionLabel,
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
                      <div className="flex flex-wrap gap-1.5">
                        {model.recommended && <Badge variant="secondary">Recommended</Badge>}
                        {model.fastest && <Badge variant="outline">Optimized for speed</Badge>}
                        {model.bestQuality && <Badge variant="secondary">High accuracy</Badge>}
                      </div>
                      <CardDescription className="leading-relaxed">{model.description}</CardDescription>
                    </CardHeader>

                    <CardContent className="flex-1 space-y-2">
                      {hasProgress && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span>{isDownloading ? "Downloading model" : "Download complete"}</span>
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
                        {isInstalled ? <RefreshCcw /> : <Download />}
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
            </CardContent>
          </Card>
        );
      })}

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
