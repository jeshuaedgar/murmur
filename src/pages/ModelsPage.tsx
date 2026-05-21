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
import { api } from "@/lib/api/tauri";
import { getErrorMessage } from "@/lib/toast";
import { isTauriRuntime } from "@/lib/runtime/tauri";

export function ModelsPage() {
  const { models, installedById, downloadProgress, downloadModel, deleteModel } = useAppState();
  const [pendingRemoveModelId, setPendingRemoveModelId] = useState<string | null>(null);
  const [isCheckingConnectivity, setIsCheckingConnectivity] = useState(false);
  const [connectivityStatus, setConnectivityStatus] = useState<"unknown" | "online" | "offline">("unknown");
  const [connectivityDetail, setConnectivityDetail] = useState("");

  const pendingModel = useMemo(
    () => models.find((model) => model.id === pendingRemoveModelId) ?? null,
    [models, pendingRemoveModelId],
  );

  useEffect(() => {
    const markOffline = () => {
      setConnectivityStatus("offline");
      setConnectivityDetail("No internet connection detected.");
    };
    const markUnknown = () => {
      setConnectivityStatus("unknown");
      setConnectivityDetail("");
    };

    if (!navigator.onLine) {
      markOffline();
    }

    window.addEventListener("offline", markOffline);
    window.addEventListener("online", markUnknown);
    return () => {
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("online", markUnknown);
    };
  }, []);

  async function confirmRemove() {
    if (!pendingRemoveModelId) {
      return;
    }
    await deleteModel(pendingRemoveModelId).catch(() => undefined);
    setPendingRemoveModelId(null);
  }

  async function checkConnectivity() {
    setIsCheckingConnectivity(true);
    try {
      if (!navigator.onLine) {
        setConnectivityStatus("offline");
        setConnectivityDetail("No internet connection detected.");
        return false;
      }
      if (!isTauriRuntime) {
        setConnectivityStatus("online");
        setConnectivityDetail("Browser reports online.");
        return true;
      }

      const status = await api.checkHuggingFaceConnectivity();
      const reachable = status.online && status.huggingfaceReachable;
      setConnectivityStatus(reachable ? "online" : "offline");
      setConnectivityDetail(
        reachable
          ? "Connected to Hugging Face."
          : getErrorMessage(status.detail, "No internet or Hugging Face is unreachable."),
      );
      return reachable;
    } catch (error) {
      setConnectivityStatus("offline");
      setConnectivityDetail(getErrorMessage(error, "No internet or Hugging Face is unreachable."));
      return false;
    } finally {
      setIsCheckingConnectivity(false);
    }
  }

  async function handleDownload(modelId: string) {
    const isConnected = await checkConnectivity();
    if (!isConnected) {
      return;
    }
    await downloadModel(modelId);
  }

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
                    onClick={() => setPendingRemoveModelId(model.id)}
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
