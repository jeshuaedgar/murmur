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
import { useModelConnectivity } from "@/features/models/hooks/use-model-connectivity";
import { useModelActions } from "@/features/models/lib/model-actions";
import { getModelCardState, getModelProgressByModelId } from "@/features/models/lib/model-view-state";

export function ModelsPage() {
  const { models, installedById, downloadProgress, downloadModel, deleteModel } = useAppState();
  const progressByModelId = useMemo(() => getModelProgressByModelId(downloadProgress), [downloadProgress]);
  const { connectivityStatus, connectivityDetail, isCheckingConnectivity, checkConnectivity } = useModelConnectivity();
  const { pendingRemoveModelId, pendingModel, openRemoveConfirmation, closeRemoveConfirmation, confirmRemove, handleDownload } =
    useModelActions({
      models,
      downloadModel,
      deleteModel,
      checkConnectivity,
    });

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="inline-flex items-center gap-2">
          <Boxes />
          Model Library
        </h1>
        <p>Download once from Hugging Face, then run offline.</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => void checkConnectivity()} disabled={isCheckingConnectivity}>
            {isCheckingConnectivity ? "Checking..." : "Check connectivity"}
          </Button>
          {connectivityStatus === "offline" && <Badge variant="destructive">No internet</Badge>}
          {connectivityStatus === "online" && <Badge variant="secondary">Online</Badge>}
        </div>
        {connectivityDetail ? <p>{connectivityDetail}</p> : null}
      </header>

      <ItemGroup className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {models.map((model) => {
          const installedModel = installedById.get(model.id);
          const progress = progressByModelId.get(model.id);
          const {
            progressValue,
            hasProgress,
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
            <Item
              key={model.id}
              variant="outline"
              className="h-full px-4 py-4"
            >
              <ItemHeader className="items-start">
                <ItemTitle>{model.name}</ItemTitle>
                <ItemActions className="flex-wrap justify-end gap-1.5">
                  <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
                  {model.recommended && <Badge variant="secondary">Recommended</Badge>}
                  {model.fastest && <Badge variant="outline">Optimized for speed</Badge>}
                  {model.bestQuality && <Badge variant="secondary">High accuracy</Badge>}
                </ItemActions>
              </ItemHeader>

              <ItemContent className="gap-3 md:grid md:grid-cols-[1fr_auto] md:gap-4">
                <div className="space-y-3">
                  <ItemDescription>{model.description}</ItemDescription>
                  <p>
                    Model ID: <code>{model.id}</code>
                  </p>
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
                <ItemActions className="flex-wrap">
                  <Button
                    variant={installButtonVariant}
                    disabled={isDownloading || isCheckingConnectivity}
                    onClick={() => void handleDownload(model.id).catch(() => undefined)}
                  >
                    <Download />
                    {isDownloading ? "Downloading..." : actionLabel}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={!isInstalled || isDownloading}
                    onClick={() => openRemoveConfirmation(model.id)}
                  >
                    <Trash2 />
                    Remove local model
                  </Button>
                </ItemActions>
              </ItemFooter>
            </Item>
          );
        })}
      </ItemGroup>

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
    </div>
  );
}
