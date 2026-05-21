import { useEffect, useMemo, useState } from "react";
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
import { Boxes, Brain, Download, FlaskConical, InfoIcon, RefreshCcw, Trash2 } from "lucide-react";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
import { useAppState } from "@/context/app-state";
import { useModelConnectivity } from "@/features/models/hooks/use-model-connectivity";
import { useModelActions } from "@/features/models/lib/model-actions";
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
  const modelsByLab = useMemo(() => {
    const grouped = new Map<string, typeof models>();
    for (const model of models) {
      const current = grouped.get(model.lab) ?? [];
      grouped.set(model.lab, [...current, model]);
    }
    const ordered = Array.from(grouped.entries()).sort(([a], [b]) => {
      if (a === "Distil-Whisper" && b !== "Distil-Whisper") return 1;
      if (b === "Distil-Whisper" && a !== "Distil-Whisper") return -1;
      return a.localeCompare(b);
    });
    return ordered;
  }, [models]);
  const { connectivityStatus, connectivityDetail, isCheckingConnectivity, checkConnectivity } = useModelConnectivity();
  const [connectivityCooldownUntil, setConnectivityCooldownUntil] = useState<number | null>(null);
  const [connectivityCooldownSeconds, setConnectivityCooldownSeconds] = useState(0);
  const isConnectivityCooldownActive = connectivityCooldownSeconds > 0;
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

  useEffect(() => {
    if (!connectivityCooldownUntil) {
      setConnectivityCooldownSeconds(0);
      return;
    }

    const tick = () => {
      const secondsLeft = Math.max(0, Math.ceil((connectivityCooldownUntil - Date.now()) / 1000));
      setConnectivityCooldownSeconds(secondsLeft);
      if (secondsLeft === 0) {
        setConnectivityCooldownUntil(null);
      }
    };

    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [connectivityCooldownUntil]);

  const onCheckConnectivity = async () => {
    if (isCheckingConnectivity || isConnectivityCooldownActive) return;
    const ok = await checkConnectivity();
    if (ok) {
      setConnectivityCooldownUntil(Date.now() + 60_000);
    }
  };

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="inline-flex items-center gap-2">
            <Boxes />
            Model Library
          </h1>
          <Button
            variant="outline"
            onClick={() => void onCheckConnectivity()}
            disabled={isCheckingConnectivity || isConnectivityCooldownActive}
          >
            {isCheckingConnectivity
              ? "Checking..."
              : isConnectivityCooldownActive
                ? `Check in ${connectivityCooldownSeconds}s`
                : "Check connectivity"}
          </Button>
        </div>
        <p>Download once from Hugging Face, then run offline.</p>
        <div className="flex flex-wrap items-center gap-2">
          {connectivityStatus === "offline" && <Badge variant="destructive">No internet</Badge>}
          {connectivityStatus === "online" && <Badge variant="secondary">Online</Badge>}
        </div>
        {connectivityDetail ? <p>{connectivityDetail}</p> : null}
      </header>

      {modelsByLab.map(([lab, labModels]) => {
        const LabIcon = lab === "OpenAI Whisper" ? Brain : FlaskConical;
        return (
          <section key={lab} className="space-y-3">
            <div className="flex items-center gap-2">
              <LabIcon className="size-4" />
              <h2>{lab}</h2>
            </div>
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
            <ItemGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  <Item
                    key={model.id}
                    variant="outline"
                    className="h-full px-4 py-4"
                  >
              <ItemHeader className="items-start">
                <ItemTitle>{model.name}</ItemTitle>
                <ItemActions className="flex-wrap justify-end gap-1.5">
                  <Badge variant="outline" className="font-mono">
                    {model.id} ({formatBytes(model.sizeBytes)})
                  </Badge>
                  {model.recommended && <Badge variant="secondary">Recommended</Badge>}
                  {model.fastest && <Badge variant="outline">Optimized for speed</Badge>}
                  {model.bestQuality && <Badge variant="secondary">High accuracy</Badge>}
                </ItemActions>
              </ItemHeader>

              <ItemContent className="gap-3 md:grid md:grid-cols-[1fr_auto] md:gap-4">
                <div className="space-y-3">
                  <ItemDescription>{model.description}</ItemDescription>
                </div>

                {hasProgress && (
                  <div className="space-y-2 p-2 md:min-w-56">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {isDownloading ? "Downloading model" : "Download complete"}
                      </span>
                      <span>{Math.round(progressValue)}%</span>
                    </div>
                    <Progress value={progressValue} aria-label={`Download progress for ${model.name}`} />
                  </div>
                )}
              </ItemContent>

              <ItemFooter className="mt-2 justify-start">
                <ItemActions className="grid w-full grid-cols-2 gap-2">
                  <Button
                    className="w-full"
                    variant={installButtonVariant}
                    disabled={isDownloading || isCheckingConnectivity}
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
                </ItemActions>
              </ItemFooter>
                  </Item>
                );
              })}
            </ItemGroup>
          </section>
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
            <AlertDialogAction onClick={() => void confirmRemove()} disabled={!pendingModel}>
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
            <AlertDialogAction onClick={() => void confirmRedownload()} disabled={!pendingRedownloadModel}>
              Re-download model
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
