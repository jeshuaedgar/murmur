import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { WandSparkles, Download, Save, PackageSearch } from "lucide-react";
import { useAppState } from "@/context/app-state";
import { useCleanupPageLogic } from "@/features/cleanup/hooks/use-cleanup-page-logic";

export function CleanupPage() {
  const { settings, models, installedById, setSettings, saveSettings, status } = useAppState();
  const {
    installedModelOptions,
    installedCount,
    cleanupRulesPreview,
    onCleanupEnabledChange,
    onLiveCleanupEnabledChange,
    onLiveCleanupModeChange,
    onFinalizeCleanupModeChange,
    onCleanupLatencyBudgetMsChange,
    onCleanupShowRawToggleChange,
    onCleanupBackendChange,
    onCleanupModelIdChange,
  } = useCleanupPageLogic({ settings, models, installedById, setSettings });
  const hasCleanupModelsInstalled = installedCount > 0;

  return (
    <div className="relative space-y-5">
      <header className="space-y-3 rounded-xl border bg-card px-5 py-4">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <WandSparkles />
          Cleanup Pipeline
        </h1>
        <p className="text-sm text-muted-foreground">
          Dedicated setup for live stop-word filtering, finalized cleanup behavior, and backend runtime/model configuration.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Live and Finalized Behavior</CardTitle>
          <CardDescription>Configure what runs live vs after segment finalization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4 py-1">
            <div className="space-y-1">
              <Label htmlFor="cleanup-enabled">Enable cleanup</Label>
              <p className="text-sm text-muted-foreground">Master switch for transcript cleanup.</p>
            </div>
            <Switch id="cleanup-enabled" checked={settings.cleanupEnabled} onCheckedChange={onCleanupEnabledChange} />
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-4 py-1">
            <div className="space-y-1">
              <Label htmlFor="live-cleanup-enabled">Enable live cleanup</Label>
              <p className="text-sm text-muted-foreground">Apply deterministic rules during live transcription.</p>
            </div>
            <Switch
              id="live-cleanup-enabled"
              checked={settings.liveCleanupEnabled}
              onCheckedChange={onLiveCleanupEnabledChange}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="live-cleanup-mode">Live mode</Label>
              <Select value={settings.liveCleanupMode} onValueChange={onLiveCleanupModeChange}>
                <SelectTrigger id="live-cleanup-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="rules">Rules only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="finalize-cleanup-mode">Finalize mode</Label>
              <Select value={settings.finalizeCleanupMode} onValueChange={onFinalizeCleanupModeChange}>
                <SelectTrigger id="finalize-cleanup-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="rules">Rules only</SelectItem>
                  <SelectItem value="rules_plus_model">Rules + backend model</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cleanup-latency-budget-ms">Finalize timeout budget (ms)</Label>
              <Input
                id="cleanup-latency-budget-ms"
                type="number"
                min={50}
                max={2000}
                value={settings.cleanupLatencyBudgetMs}
                onChange={(event) => onCleanupLatencyBudgetMsChange(event.target.value)}
              />
            </div>
            <div className="flex items-start justify-between gap-4 py-1">
              <div className="space-y-1">
                <Label htmlFor="show-raw-toggle">Allow raw transcript toggle</Label>
                <p className="text-sm text-muted-foreground">Expose clean/raw view switching in the transcript panel.</p>
              </div>
              <Switch
                id="show-raw-toggle"
                checked={settings.cleanupShowRawToggle}
                onCheckedChange={onCleanupShowRawToggleChange}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rules Profile</CardTitle>
          <CardDescription>Current deterministic cleanup rules used in live and fallback behavior.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {cleanupRulesPreview.map((rule) => (
            <div key={rule} className="rounded-md border px-3 py-2 text-sm">
              {rule}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backend Runtime and Models</CardTitle>
          <CardDescription>
            Choose the cleanup backend and select local model resources. Cleanup models use a different backend path than Whisper transcription.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-hidden rounded-xl border bg-muted/10">
            <div className="min-h-[260px] p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Installed models: {installedCount}</Badge>
                <Badge variant="outline">Status: {status}</Badge>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="cleanup-backend">Cleanup backend</Label>
                <Select value={settings.cleanupBackend} onValueChange={onCleanupBackendChange}>
                  <SelectTrigger id="cleanup-backend" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rules_only">Rules only (lowest latency)</SelectItem>
                    <SelectItem value="local_model">Local model pipeline</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="cleanup-model-id">Cleanup model</Label>
                <Select
                  value={settings.cleanupModelId ?? "__none__"}
                  onValueChange={(value) => onCleanupModelIdChange(value === "__none__" ? "" : value)}
                >
                  <SelectTrigger id="cleanup-model-id" className="w-full">
                    <SelectValue placeholder="Select installed model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (fallback to default behavior)</SelectItem>
                    {installedModelOptions.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.lab} - {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-3 border-t pt-5">
          <Button asChild variant="outline">
            <Link to="/models" hash="cleanup-models">
              <Download />
              Manage model downloads
            </Link>
          </Button>
          <Button onClick={() => void saveSettings()}>
            <Save />
            Save cleanup settings
          </Button>
        </CardFooter>
      </Card>

      {!hasCleanupModelsInstalled && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 p-4 backdrop-blur-[1px]">
          <Empty className="w-full max-w-xl rounded-xl border border-dashed bg-background px-6 py-8 shadow-md">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PackageSearch />
              </EmptyMedia>
              <EmptyTitle>No cleanup models installed</EmptyTitle>
              <EmptyDescription>
                Install a model from the Models page under the <code>Cleanup Models</code> category to enable local-model cleanup backend.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline">
                <Link to="/models" hash="cleanup-models">
                  <Download />
                  Go to Models
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      )}
    </div>
  );
}
