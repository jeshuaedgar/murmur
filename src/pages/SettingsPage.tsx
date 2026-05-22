import { useCallback, useEffect, useMemo, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Database, Gauge, Mic2, PlugZap, Save, Settings2, ShieldCheck, Sparkles } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useAppState } from "@/context/app-state";
import { useModelConnectivity } from "@/features/models/hooks/use-model-connectivity";
import { useSettingsPageLogic } from "@/features/settings/hooks/use-settings-page-logic";
import { updateDefaultModelId } from "@/features/settings/lib/settings-updaters";
import { api } from "@/lib/api/tauri";
import { toastInfo } from "@/lib/toast";

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

  const [savedSettingsSnapshot, setSavedSettingsSnapshot] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [settingsStatusMessage, setSettingsStatusMessage] = useState("");
  const [hasShownUnsavedToast, setHasShownUnsavedToast] = useState(false);

  const isSettingsLoading = models.length === 0;

  const setTrackedSettings = useCallback<typeof setSettings>(
    (updater) => {
      setSettings((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (JSON.stringify(prev) !== JSON.stringify(next)) {
          setHasInteracted(true);
        }
        return next;
      });
    },
    [setSettings],
  );

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
    onAutoPasteChange,
    onStartAtLoginChange,
    onCleanupEnabledChange,
    onLiveCleanupEnabledChange,
    onLiveCleanupModeChange,
    onFinalizeCleanupModeChange,
    onCleanupLatencyBudgetMsChange,
    onCleanupShowRawToggleChange,
    onHistoryRetentionDaysChange,
    onHistoryRetentionIncludePinnedChange,
    onOverlayShortcutChange,
    onOverlayPinnedChange,
    onOverlayHideStopsRecordingChange,
    onOverlayEnabledChange,
    onSaveSettings,
  } = useSettingsPageLogic({
    models,
    installedById,
    browserAudioInputs,
    backendAudioInputs,
    defaultModelId: settings.defaultModelId,
    setSettings: setTrackedSettings,
    saveSettings,
  });
  const currentSettingsSnapshot = useMemo(() => {
    const normalizedDefaultModelId =
      installedById.get(settings.defaultModelId)?.installed || !resolvedDefaultModelId
        ? settings.defaultModelId
        : resolvedDefaultModelId;
    return JSON.stringify({ ...settings, defaultModelId: normalizedDefaultModelId });
  }, [installedById, resolvedDefaultModelId, settings]);
  const isDirty = savedSettingsSnapshot !== null && currentSettingsSnapshot !== savedSettingsSnapshot;

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
  const cacheClearToastId = "settings-cache-clear";
  const catalogRefreshToastId = "settings-catalog-refresh";
  const diagnosticsToastId = "settings-run-diagnostics";

  const automationEnabledCount = [
    settings.translate,
    settings.autoCopy,
    settings.autoPaste,
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
    if (!hasInteracted) {
      setSavedSettingsSnapshot(currentSettingsSnapshot);
    }
  }, [currentSettingsSnapshot, hasInteracted]);

  useEffect(() => {
    if (!isDirty || !hasInteracted) {
      setHasShownUnsavedToast(false);
      return;
    }
    if (hasShownUnsavedToast) return;
    toastInfo("Unsaved changes", "Remember to save your Settings changes.");
    setHasShownUnsavedToast(true);
  }, [hasInteracted, hasShownUnsavedToast, isDirty]);

  useEffect(() => {
    if (!resolvedDefaultModelId || resolvedDefaultModelId === settings.defaultModelId) {
      return;
    }
    setSettings(updateDefaultModelId(resolvedDefaultModelId));
  }, [resolvedDefaultModelId, setSettings, settings.defaultModelId]);

  useEffect(() => {
    void refreshCacheDiagnostics();
  }, [refreshCacheDiagnostics]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, [isDirty]);

  useBlocker({
    disabled: !isDirty,
    shouldBlockFn: () => !window.confirm("You have unsaved settings changes. Leave this page without saving?"),
  });

  async function onSaveAllSettings() {
    if (!isDirty || isSavingSettings) return;
    setIsSavingSettings(true);
    setSettingsStatusMessage("Saving settings");
    try {
      await onSaveSettings();
      const savedAt = new Date();
      setSavedSettingsSnapshot(currentSettingsSnapshot);
      setHasInteracted(false);
      setLastSavedAt(savedAt);
      setSettingsStatusMessage("Settings saved");
    } catch {
      setSettingsStatusMessage("Saving settings failed");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function onClearCache() {
    if (isCacheActionBusy) return;
    setIsClearingCache(true);
    toast.loading("Clearing cache", {
      id: cacheClearToastId,
      description: "Removing local model catalog cache.",
    });
    try {
      await api.invalidateModelCatalogCache();
      toast.success("Cache cleared", {
        id: cacheClearToastId,
        description: "Catalog cache has been reset.",
      });
      await refreshCacheDiagnostics();
    } catch (error) {
      toast.error("Could not clear cache", {
        id: cacheClearToastId,
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsClearingCache(false);
    }
  }

  async function onRefreshCatalog() {
    if (isCacheActionBusy) return;
    setIsRefreshingCatalog(true);
    toast.loading("Refreshing catalog", {
      id: catalogRefreshToastId,
      description: "Fetching the latest model catalog.",
    });
    try {
      await api.invalidateModelCatalogCache();
      await api.listModels();
      toast.success("Catalog refreshed", {
        id: catalogRefreshToastId,
        description: "Fetched latest model catalog.",
      });
      await refreshCacheDiagnostics();
    } catch (error) {
      toast.error("Could not refresh catalog", {
        id: catalogRefreshToastId,
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsRefreshingCatalog(false);
    }
  }

  async function onRunAllDiagnostics() {
    if (isRunningDiagnostics || isCheckingConnectivity || isCacheActionBusy) return;
    setIsRunningDiagnostics(true);
    toast.loading("Running diagnostics", {
      id: diagnosticsToastId,
      description: "Checking connectivity and cache health.",
    });
    try {
      const reachable = await checkConnectivity();
      await refreshCacheDiagnostics();
      if (reachable) {
        toast.success("Diagnostics complete", {
          id: diagnosticsToastId,
          description: "Connectivity and cache diagnostics were updated.",
        });
      } else {
        toast.warning("Diagnostics complete", {
          id: diagnosticsToastId,
          description: "Cache diagnostics were updated. Connectivity warnings are shown above.",
        });
      }
    } catch (error) {
      toast.error("Diagnostics failed", {
        id: diagnosticsToastId,
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setIsRunningDiagnostics(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Manage model, input, automation, diagnostics, and storage preferences.</CardDescription>
        </CardHeader>
      </Card>

      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {settingsStatusMessage}
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-muted-foreground" />
            General Settings
          </CardTitle>
          <CardDescription>Choose the default model and transcription language.</CardDescription>
          <CardAction>
            <Badge variant="outline">Model: {resolvedDefaultModelId ?? "Not set"}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="default-model">Default model</Label>
            {isSettingsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={resolvedDefaultModelId ?? settings.defaultModelId} onValueChange={onDefaultModelChange}>
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
            )}
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
        <CardFooter className="justify-end gap-2">
          <div className="mr-auto text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
            {lastSavedAt ? `Last saved at ${lastSavedAt.toLocaleTimeString()}` : "Not saved yet in this session"}
          </div>
          <Button
            onClick={() => void onSaveAllSettings()}
            disabled={!isDirty || isSavingSettings}
            aria-label="Save settings changes"
          >
            {isSavingSettings ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {isSavingSettings ? "Saving..." : "Save settings"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Mic2 className="size-4 text-muted-foreground" />
            Audio Input Settings
          </CardTitle>
          <CardDescription>Select the preferred capture device.</CardDescription>
          <CardAction>
            <Badge variant="outline">{browserInputOptions.length} browser inputs</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
            <Label htmlFor="audio-input">Audio input device</Label>
            {isSettingsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={settings.audioInputDeviceId ?? ""} onValueChange={onAudioInputChange}>
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
            )}
            </div>
            <p className="text-sm text-muted-foreground">{audioInputsSummary}</p>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={() => void onSaveAllSettings()}
            disabled={!isDirty || isSavingSettings}
            aria-label="Save settings changes"
          >
            {isSavingSettings ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {isSavingSettings ? "Saving..." : "Save settings"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle className="inline-flex items-center gap-2">
            <Settings2 className="size-4 text-muted-foreground" />
            Automation
          </CardTitle>
          <CardDescription>Configure transcript behavior, cleanup policy, and startup defaults.</CardDescription>
          <CardAction>
            <Badge variant="outline">{automationEnabledCount} enabled</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="pt-1">
              <p className="text-sm font-medium">Transcription behavior</p>
              <p className="text-xs text-muted-foreground">Controls that affect translation, retention, and clipboard behavior.</p>
            </div>
            <div className="flex items-start justify-between gap-4 py-1">
              <div className="flex flex-col gap-1">
              <Label htmlFor="translate">Translate to English</Label>
              <p className="text-sm text-muted-foreground">When enabled, transcription output is translated to English.</p>
              </div>
              <Switch id="translate" checked={settings.translate} onCheckedChange={onTranslateChange} />
            </div>
            <Separator />
            <div className="grid grid-cols-1 gap-4 py-1 md:grid-cols-2">
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
                <div className="flex flex-col gap-1">
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
              <div className="flex flex-col gap-1">
              <Label htmlFor="autocopy">Auto-copy transcript</Label>
              <p className="text-sm text-muted-foreground">Copy finished transcript text directly to the clipboard.</p>
              </div>
              <Switch id="autocopy" checked={settings.autoCopy} onCheckedChange={onAutoCopyChange} />
            </div>
            <Separator />
            <div className="flex items-start justify-between gap-4 py-1">
              <div className="flex flex-col gap-1">
              <Label htmlFor="autopaste">Auto-paste after completion</Label>
              <p className="text-sm text-muted-foreground">Paste into the active app once each time transcription completes.</p>
              </div>
              <Switch id="autopaste" checked={settings.autoPaste} onCheckedChange={onAutoPasteChange} />
            </div>
            <Separator />
            <div className="flex items-start justify-between gap-4 py-1">
              <div className="flex flex-col gap-1">
              <Label htmlFor="cleanup-enabled">Transcript cleanup</Label>
              <p className="text-sm text-muted-foreground">Enable stop-word/filler cleanup and punctuation normalization.</p>
              </div>
              <Switch id="cleanup-enabled" checked={settings.cleanupEnabled} onCheckedChange={onCleanupEnabledChange} />
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium">Cleanup pipeline</p>
              <p className="text-xs text-muted-foreground">Tune live cleanup, finalize mode, and timeout behavior.</p>
            </div>
            <div className="flex items-start justify-between gap-4 py-1">
              <div className="flex flex-col gap-1">
              <Label htmlFor="live-cleanup-enabled">Live cleanup</Label>
              <p className="text-sm text-muted-foreground">Apply lightweight rules while live transcription is running.</p>
              </div>
              <Switch id="live-cleanup-enabled" checked={settings.liveCleanupEnabled} onCheckedChange={onLiveCleanupEnabledChange} />
            </div>
            <Separator />
            <div className="grid grid-cols-1 gap-4 py-1 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="live-cleanup-mode">Live cleanup mode</Label>
                <Select value={settings.liveCleanupMode} onValueChange={onLiveCleanupModeChange}>
                  <SelectTrigger id="live-cleanup-mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="off">Off</SelectItem>
                      <SelectItem value="rules">Rules only</SelectItem>
                    </SelectGroup>
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
                    <SelectGroup>
                      <SelectItem value="off">Off</SelectItem>
                      <SelectItem value="rules">Rules only</SelectItem>
                      <SelectItem value="rules_plus_model">Rules + model pipeline</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-1 gap-4 py-1 md:grid-cols-2">
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
                <div className="flex flex-col gap-1">
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
            <div>
              <p className="text-sm font-medium">Startup</p>
              <p className="text-xs text-muted-foreground">Configure app launch behavior for your device.</p>
            </div>
            <div className="flex items-start justify-between gap-4 py-1">
              <div className="flex flex-col gap-1">
              <Label htmlFor="start-at-login">Start at login</Label>
              <p className="text-sm text-muted-foreground">Launch Murmur automatically when you sign in.</p>
              </div>
              <Switch id="start-at-login" checked={settings.startAtLogin} onCheckedChange={onStartAtLoginChange} />
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium">Overlay</p>
              <p className="text-xs text-muted-foreground">Configure floating window behavior and global trigger shortcut.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 py-1 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="overlay-shortcut">Overlay shortcut</Label>
                <Input
                  id="overlay-shortcut"
                  placeholder="CmdOrCtrl+Shift+Space"
                  value={settings.overlayShortcut}
                  onChange={(event) => onOverlayShortcutChange(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">Example: CmdOrCtrl+Shift+Space</p>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4 py-1">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="overlay-enabled">Enable floating overlay</Label>
                    <p className="text-sm text-muted-foreground">Keep the overlay available while Murmur runs.</p>
                  </div>
                  <Switch id="overlay-enabled" checked={settings.overlayEnabled} onCheckedChange={onOverlayEnabledChange} />
                </div>
                <div className="flex items-start justify-between gap-4 py-1">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="overlay-pinned">Pin overlay on top</Label>
                    <p className="text-sm text-muted-foreground">Keep the overlay always on top of other windows.</p>
                  </div>
                  <Switch id="overlay-pinned" checked={settings.overlayPinned} onCheckedChange={onOverlayPinnedChange} />
                </div>
                <div className="flex items-start justify-between gap-4 py-1">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="overlay-hide-stop">Hide button stops recording</Label>
                    <p className="text-sm text-muted-foreground">When enabled, hiding the overlay finalizes recording and transcription.</p>
                  </div>
                  <Switch
                    id="overlay-hide-stop"
                    checked={settings.overlayHideStopsRecording}
                    onCheckedChange={onOverlayHideStopsRecordingChange}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={() => void onSaveAllSettings()}
            disabled={!isDirty || isSavingSettings}
            aria-label="Save settings changes"
          >
            {isSavingSettings ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {isSavingSettings ? "Saving..." : "Save settings"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" />
            Connectivity Diagnostics
          </CardTitle>
          <CardDescription>Check network reachability and model catalog cache health.</CardDescription>
          <CardAction>
            <Badge variant="outline">Cache: {cacheDiagnostics?.status ?? "unknown"}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">Connectivity diagnostics</p>
            <div className="flex flex-wrap items-center gap-2">
              {connectivityStatus === "offline" && <Badge variant="destructive">Status: Offline</Badge>}
              {connectivityStatus === "online" && <Badge variant="secondary">Status: Online</Badge>}
              {connectivityStatus === "unknown" && <Badge variant="outline">Status: Unknown</Badge>}
            </div>
            {connectivityDetail ? <p className="text-sm text-muted-foreground">{connectivityDetail}</p> : null}
          </div>

            <Separator />

            <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Model catalog cache</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void onClearCache()}
                  disabled={isCacheActionBusy || isCheckingConnectivity || isRunningDiagnostics}
                  aria-label="Clear model catalog cache"
                >
                  {isClearingCache ? <Spinner data-icon="inline-start" /> : <Database data-icon="inline-start" />}
                  Clear cache
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void onRefreshCatalog()}
                  disabled={isCacheActionBusy || isCheckingConnectivity || isRunningDiagnostics}
                  aria-label="Refresh model catalog now"
                >
                  {isRefreshingCatalog ? <Spinner data-icon="inline-start" /> : <PlugZap data-icon="inline-start" />}
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
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            variant="outline"
            onClick={() => void onRunAllDiagnostics()}
            disabled={isRunningDiagnostics || isCheckingConnectivity || isCacheActionBusy}
            aria-label="Run connectivity and cache diagnostics"
          >
            {isRunningDiagnostics || isCheckingConnectivity ? <Spinner data-icon="inline-start" /> : <Gauge data-icon="inline-start" />}
            {isRunningDiagnostics || isCheckingConnectivity ? "Running diagnostics..." : "Run all diagnostics"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Database className="size-4 text-muted-foreground" />
            Storage Settings
          </CardTitle>
          <CardDescription>Review where app data and settings are stored.</CardDescription>
          <CardAction>
            <Badge variant="outline">Local settings</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 text-sm">
            <p>
              App data: <code className="break-all">{appDataDir}</code>
            </p>
            <p>
              Settings file: <code className="break-all">{settingsFilePath || "~/.config/murmur/settings.yaml"}</code>
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            onClick={() => void onSaveAllSettings()}
            disabled={!isDirty || isSavingSettings}
            aria-label="Save settings changes"
          >
            {isSavingSettings ? <Spinner data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {isSavingSettings ? "Saving..." : "Save settings"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
