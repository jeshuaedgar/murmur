import { useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Boxes, Download, Trash2 } from "lucide-react";
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

export function ModelsPage() {
  const { models, installedById, downloadProgress, downloadModel, deleteModel } = useAppState();
  const [pendingRemoveModelId, setPendingRemoveModelId] = useState<string | null>(null);

  const pendingModel = useMemo(
    () => models.find((model) => model.id === pendingRemoveModelId) ?? null,
    [models, pendingRemoveModelId],
  );

  async function confirmRemove() {
    if (!pendingRemoveModelId) {
      return;
    }
    await deleteModel(pendingRemoveModelId).catch(() => undefined);
    setPendingRemoveModelId(null);
  }

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="display-title inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Boxes className="size-5" />
          Model Library
        </h1>
        <p className="text-sm">Download once from Hugging Face, then run offline.</p>
      </header>

      <ItemGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {models.map((model) => {
          const installedModel = installedById.get(model.id);
          const progress = Array.from(downloadProgress.values()).find((item) => item.modelId === model.id);
          const progressPct = progress?.progressPct;
          const hasProgress = typeof progressPct === "number";
          const progressValue = hasProgress ? Math.max(0, Math.min(progressPct, 100)) : 0;
          const isInstalled = Boolean(installedModel?.installed);
          const isDownloading = hasProgress && progressValue < 100;
          const actionLabel = isInstalled ? "Reinstall model" : "Install model";
          const statusLabel = isDownloading
            ? "Downloading"
            : isInstalled
              ? "Installed locally"
              : "Not installed";
          const statusBadgeVariant = isDownloading
            ? "secondary"
            : isInstalled
              ? "default"
              : "outline";
          const installButtonVariant = isInstalled ? "secondary" : "default";

          return (
            <Item
              key={model.id}
              variant="outline"
              className="feature-card island-shell h-full px-4 py-4"
            >
              <ItemHeader className="items-start">
                <ItemTitle className="text-lg">{model.name}</ItemTitle>
                <ItemActions className="flex-wrap justify-end gap-1.5">
                  <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
                  {model.recommended && <Badge variant="secondary">Recommended</Badge>}
                  {model.fastest && <Badge variant="outline">Optimized for speed</Badge>}
                  {model.bestQuality && <Badge variant="secondary">High accuracy</Badge>}
                </ItemActions>
              </ItemHeader>

              <ItemContent className="gap-3 md:grid md:grid-cols-[1fr_auto] md:gap-4">
                <div className="space-y-3">
                  <ItemDescription className="line-clamp-none text-sm">{model.description}</ItemDescription>
                  <p className="text-xs">
                    Model ID: <code>{model.id}</code>
                  </p>
                </div>

                {hasProgress && (
                  <div className="space-y-2 p-2 md:min-w-56">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium">
                        {isDownloading ? "Downloading model" : "Download complete"}
                      </span>
                      <span>{Math.round(progressValue)}%</span>
                    </div>
                    <Progress value={progressValue} aria-label={`Download progress for ${model.name}`} />
                  </div>
                )}
              </ItemContent>

              <ItemFooter className="mt-2 justify-start">
                <ItemActions className="flex-wrap">
                  <Button
                    variant={installButtonVariant}
                    disabled={isDownloading}
                    onClick={() => void downloadModel(model.id).catch(() => undefined)}
                  >
                    <Download className="size-4" />
                    {isDownloading ? "Downloading..." : actionLabel}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!isInstalled || isDownloading}
                    onClick={() => setPendingRemoveModelId(model.id)}
                  >
                    <Trash2 className="size-4" />
                    Remove local model
                  </Button>
                </ItemActions>
              </ItemFooter>
            </Item>
          );
        })}
      </ItemGroup>

      <AlertDialog open={Boolean(pendingRemoveModelId)} onOpenChange={(open) => !open && setPendingRemoveModelId(null)}>
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
    </div>
  );
}
