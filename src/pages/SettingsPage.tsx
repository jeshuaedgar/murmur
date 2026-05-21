import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic2, Save, Settings2 } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useAppState } from "@/context/app-state";
import { useModelConnectivity } from "@/features/models/hooks/use-model-connectivity";
import { useSettingsPageLogic } from "@/features/settings/hooks/use-settings-page-logic";
import { updateDefaultModelId } from "@/features/settings/lib/settings-updaters";
import { api } from "@/lib/api/tauri";
import { toastError, toastSuccess, toastWarning } from "@/lib/toast";

export function SettingsPage() {
  const {
    settings,
    models,
    installedById,
    browserAudioInputs,
    backendAudioInputs,
    appDataDir,
    settingsFilePath,
    setSettings,
    saveSettings,
  } = useAppState();
  const {
    modelOptionsByLab,
    resolvedDefaultModelId,
    browserInputOptions,
    audioInputsSummary,
    onDefaultModelChange,
    onLanguageChange,
    onAudioInputChange,
    onTranslateChange,
    onAutoCopyChange,
    onStartAtLoginChange,
    onCleanupEnabledChange,
    onLiveCleanupEnabledChange,
    onLiveCleanupModeChange,
    onFinalizeCleanupModeChange,
    onCleanupLatencyBudgetMsChange,
    onCleanupShowRawToggleChange,
    onHistoryRetentionDaysChange,
    onHistoryRetentionIncludePinnedChange,
    onSaveSettings,
  } = useSettingsPageLogic({
    models,
    installedById,
    browserAudioInputs,
    backendAudioInputs,
    defaultModelId: settings.defaultModelId,
    setSettings,
    saveSettings,
  });
  const {
    connectivityStatus,
    connectivityDetail,
    cacheDiagnostics,
    refreshCacheDiagnostics,
    isCheckingConnectivity,
    checkConnectivity,
  } = useModelConnectivity();
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const isCacheActionBusy = isClearingCache || isRefreshingCatalog;
  const automationEnabledCount = [
    settings.translate,
    settings.autoCopy,
    settings.cleanupEnabled,
    settings.liveCleanupEnabled,
    settings.cleanupShowRawToggle,
    settings.startAtLogin,
  ].filter(Boolean).length;

  const cacheStatusCopy = useMemo(() => {
    if (!cacheDiagnostics) {
      return "No cache diagnostics yet. Refresh the catalog to initialize cache details.";
    }
    const ageText =
      typeof cacheDiagnostics.ageMs === "number"
        ? `Last updated ${Math.round(cacheDiagnostics.ageMs / 1000)} seconds ago.`
        : "No fetch timestamp available yet.";
    const status = cacheDiagnostics.status.toLowerCase();
    if (status.includes("fresh")) {
      return `Catalog cache is fresh. ${ageText}`;
    }
    if (status.includes("stale")) {
      return `Catalog cache is stale but still usable offline. ${ageText}`;
    }
    if (status.includes("offline")) {
      return `Offline fallback is active. ${ageText}`;
    }
    return `Catalog cache status: ${cacheDiagnostics.status}. ${ageText}`;
  }, [cacheDiagnostics]);

  useEffect(() => {
    if (!resolvedDefaultModelId || resolvedDefaultModelId === settings.defaultModelId) {
      return;
    }
    setSettings(updateDefaultModelId(resolvedDefaultModelId));
  }, [resolvedDefaultModelId, setSettings, settings.defaultModelId]);

  useEffect(() => {
    void refreshCacheDiagnostics();
  }, [refreshCacheDiagnostics]);

  async function onClearCache() {
    if (isCacheActionBusy) return;
    setIsClearingCache(true);
    try {
      await api.invalidateModelCatalogCache();
      toastSuccess("Cache cleared", "Catalog cache has been reset.");
      await refreshCacheDiagnostics();
    } catch (error) {
      toastError(error, "Could not clear cache");
    } finally {
      setIsClearingCache(false);
    }
  }

  async function onRefreshCatalog() {
    if (isCacheActionBusy) return;
    setIsRefreshingCatalog(true);
    try {
      await api.invalidateModelCatalogCache();
      await api.listModels();
      toastSuccess("Catalog refreshed", "Fetched latest model catalog.");
      await refreshCacheDiagnostics();
    } catch (error) {
      toastError(error, "Could not refresh catalog");
    } finally {
      setIsRefreshingCatalog(false);
    }
  }

  async function onRunAllDiagnostics() {
    if (isRunningDiagnostics || isCheckingConnectivity || isCacheActionBusy) return;
    setIsRunningDiagnostics(true);
    try {
      const reachable = await checkConnectivity();
      await refreshCacheDiagnostics();
      if (reachable) {
        toastSuccess("Diagnostics complete", "Connectivity and cache diagnostics were updated.");
      } else {
        toastWarning("Diagnostics complete", "Connectivity failed; cache diagnostics were still updated.");
      }
    } catch (error) {
      toastError(error, "Diagnostics failed");
    } finally {
      setIsRunningDiagnostics(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2 text-2xl md:text-3xl">
            <Settings2 className="size-5" />
            Preferences
          </CardTitle>
          <CardDescription>Configure model, language, audio input, and automation behavior.</CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Default model and language settings.</CardDescription>
          <CardAction>
            <Badge variant="outline">Model: {resolvedDefaultModelId ?? "Not set"}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="default-model">Default model</Label>
            <Select
              value={resolvedDefaultModelId ?? settings.defaultModelId}
              onValueChange={onDefaultModelChange}
            >
              <SelectTrigger id="default-model" className="w-full">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {modelOptionsByLab.map((group) => (
                  <SelectGroup key={group.lab}>
                    <SelectLabel>{group.lab}</SelectLabel>
                    {group.options.map((model) => (
                      <SelectItem key={model.id} value={model.id} disabled={model.disabled}>
                        {model.name}
                        {model.disabled ? " (not downloaded)" : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="language">Language</Label>
            <Input
              id="language"
              placeholder="auto (or language code like en, fr, de)"
              value={settings.language}
              onChange={(event) => onLanguageChange(event.target.value)}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={() => void onSaveSettings()}>
            <Save />
            Save settings
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Mic2 />
            Audio Input
          </CardTitle>
          <CardDescription>Select the preferred capture device.</CardDescription>
          <CardAction>
            <Badge variant="outline">{browserInputOptions.length} browser inputs</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="audio-input">Audio input device</Label>
            <Select
              value={settings.audioInputDeviceId ?? ""}
              onValueChange={onAudioInputChange}
            >
              <SelectTrigger id="audio-input" className="w-full">
                <SelectValue placeholder="Select input" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {browserInputOptions.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <p>{audioInputsSummary}</p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={() => void onSaveSettings()}>
            <Save />
            Save settings
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
          <CardDescription>Toggle transcript post-processing options and startup behavior.</CardDescription>
          <CardAction>
            <Badge variant="outline">{automationEnabledCount} enabled</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start justify-between gap-4 py-1">
            <div className="space-y-1">
              <Label htmlFor="translate">Translate to English</Label>
              <p className="text-sm text-muted-foreground">When enabled, transcription output is translated to English.</p>
            </div>
            <Switch
              id="translate"
              checked={settings.translate}
              onCheckedChange={onTranslateChange}
            />
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 py-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="history-retention-days">Auto-delete history older than N days</Label>
              <Input
                id="history-retention-days"
                type="number"
                min={1}
                placeholder="Disabled"
                value={settings.historyRetentionDays ?? ""}
                onChange={(event) => onHistoryRetentionDaysChange(event.target.value)}
              />
            </div>
            <div className="flex items-start justify-between gap-4 py-1">
              <div className="space-y-1">
                <Label htmlFor="history-retention-include-pinned">Include pinned entries</Label>
                <p className="text-sm text-muted-foreground">Apply retention policy to pinned history as well.</p>
              </div>
              <Switch
                id="history-retention-include-pinned"
                checked={settings.historyRetentionIncludePinned}
                onCheckedChange={onHistoryRetentionIncludePinnedChange}
              />
            </div>
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-4 py-1">
            <div className="space-y-1">
              <Label htmlFor="autocopy">Auto-copy transcript</Label>
              <p className="text-sm text-muted-foreground">Copy finished transcript text directly to the clipboard.</p>
            </div>
            <Switch
              id="autocopy"
              checked={settings.autoCopy}
              onCheckedChange={onAutoCopyChange}
            />
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-4 py-1">
            <div className="space-y-1">
              <Label htmlFor="cleanup-enabled">Transcript cleanup</Label>
              <p className="text-sm text-muted-foreground">Enable stop-word/filler cleanup and punctuation normalization.</p>
            </div>
            <Switch
              id="cleanup-enabled"
              checked={settings.cleanupEnabled}
              onCheckedChange={onCleanupEnabledChange}
            />
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-4 py-1">
            <div className="space-y-1">
              <Label htmlFor="live-cleanup-enabled">Live cleanup</Label>
              <p className="text-sm text-muted-foreground">Apply lightweight rules while live transcription is running.</p>
            </div>
            <Switch
              id="live-cleanup-enabled"
              checked={settings.liveCleanupEnabled}
              onCheckedChange={onLiveCleanupEnabledChange}
            />
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 py-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="live-cleanup-mode">Live cleanup mode</Label>
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="finalize-cleanup-mode">Finalize cleanup mode</Label>
              <Select value={settings.finalizeCleanupMode} onValueChange={onFinalizeCleanupModeChange}>
                <SelectTrigger id="finalize-cleanup-mode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="rules">Rules only</SelectItem>
                  <SelectItem value="rules_plus_model">Rules + model pipeline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 py-1">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cleanup-latency-budget-ms">Cleanup timeout budget (ms)</Label>
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
                <Label htmlFor="cleanup-show-raw-toggle">Show raw transcript toggle</Label>
                <p className="text-sm text-muted-foreground">Allow switching between cleaned and raw transcript text.</p>
              </div>
              <Switch
                id="cleanup-show-raw-toggle"
                checked={settings.cleanupShowRawToggle}
                onCheckedChange={onCleanupShowRawToggleChange}
              />
            </div>
          </div>
          <Separator />
          <div className="flex items-start justify-between gap-4 py-1">
            <div className="space-y-1">
              <Label htmlFor="start-at-login">Start at login</Label>
              <p className="text-sm text-muted-foreground">Launch Murmur automatically when you sign in.</p>
            </div>
            <Switch
              id="start-at-login"
              checked={settings.startAtLogin}
              onCheckedChange={onStartAtLoginChange}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={() => void onSaveSettings()}>
            <Save />
            Save settings
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Debugging</CardTitle>
          <CardDescription>Connectivity and cache diagnostics for model downloads and catalog refresh.</CardDescription>
          <CardAction>
            <Badge variant="outline">Cache: {cacheDiagnostics?.status ?? "unknown"}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Connectivity diagnostics</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {connectivityStatus === "offline" && <Badge variant="destructive">Status: Offline</Badge>}
              {connectivityStatus === "online" && <Badge variant="secondary">Status: Online</Badge>}
              {connectivityStatus === "unknown" && <Badge variant="outline">Status: Unknown</Badge>}
            </div>
            {connectivityDetail ? <p className="text-sm text-muted-foreground">{connectivityDetail}</p> : null}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Model catalog cache</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void onClearCache()}
                  disabled={isCacheActionBusy || isCheckingConnectivity || isRunningDiagnostics}
                  aria-label="Clear model catalog cache"
                >
                  {isClearingCache ? <Spinner /> : null}
                  Clear cache
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void onRefreshCatalog()}
                  disabled={isCacheActionBusy || isCheckingConnectivity || isRunningDiagnostics}
                  aria-label="Refresh model catalog now"
                >
                  {isRefreshingCatalog ? <Spinner /> : null}
                  Refresh catalog now
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{cacheStatusCopy}</p>
            {cacheDiagnostics ? (
              <p className="text-xs text-muted-foreground">
                Cache key {cacheDiagnostics.key} | TTL {Math.round(cacheDiagnostics.ttlMs / 60000)} minutes
              </p>
            ) : null}
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            variant="outline"
            onClick={() => void onRunAllDiagnostics()}
            disabled={isRunningDiagnostics || isCheckingConnectivity || isCacheActionBusy}
          >
            {(isRunningDiagnostics || isCheckingConnectivity) ? <Spinner /> : null}
            {(isRunningDiagnostics || isCheckingConnectivity) ? "Running diagnostics..." : "Run all diagnostics"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <CardDescription>Review the active app data directory.</CardDescription>
          <CardAction>
            <Badge variant="outline">Local settings</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p>
            App data: <code className="break-all">{appDataDir}</code>
          </p>
          <p>
            Settings file: <code className="break-all">{settingsFilePath || "~/.config/murmur/settings.yaml"}</code>
          </p>
        </CardContent>
        <CardFooter className="justify-end">
          <Button onClick={() => void onSaveSettings()}>
            <Save />
            Save settings
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
