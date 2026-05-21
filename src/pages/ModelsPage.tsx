import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAppState } from "@/context/app-state";

export function ModelsPage() {
  const { models, installedById, downloadProgress, downloadModel, deleteModel } = useAppState();

  return (
    <div>
      <div className="mb-3 text-sm text-muted-foreground">Download once from Hugging Face, then run offline.</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {models.map((model) => {
          const installedModel = installedById.get(model.id);
          const progress = Array.from(downloadProgress.values()).find((item) => item.modelId === model.id);

          return (
            <Card key={model.id}>
              <CardHeader>
                <CardTitle className="text-base">{model.name}</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {model.recommended && <Badge>Recommended</Badge>}
                  {model.fastest && <Badge variant="secondary">Fastest</Badge>}
                  {model.bestQuality && <Badge variant="outline">Best Quality</Badge>}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">{model.description}</p>
                <code className="text-xs">{model.id}</code>
                <p className="text-sm">{installedModel?.installed ? "Installed" : "Not installed"}</p>

                {typeof progress?.progressPct === "number" && (
                  <Progress value={Math.max(0, Math.min(progress.progressPct, 100))} />
                )}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void downloadModel(model.id)}>
                    {installedModel?.installed ? "Re-download" : "Download"}
                  </Button>
                  <Button variant="secondary" disabled={!installedModel?.installed} onClick={() => void deleteModel(model.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
