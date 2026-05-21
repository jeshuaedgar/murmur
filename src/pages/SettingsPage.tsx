import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic2, Save, Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAppState } from "@/context/app-state";
import { useModelConnectivity } from "@/features/models/hooks/use-model-connectivity";
import { useSettingsPageLogic } from "@/features/settings/hooks/use-settings-page-logic";
import { updateDefaultModelId } from "@/features/settings/lib/settings-updaters";

export function SettingsPage() {
  const {
    settings,
    models,
    installedById,
    browserAudioInputs,
    backendAudioInputs,
    appDataDir,
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
    onAutoCopyChange,
    onStartAtLoginChange,
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
  const { connectivityStatus, connectivityDetail, isCheckingConnectivity, checkConnectivity } = useModelConnectivity();

  useEffect(() => {
    if (!resolvedDefaultModelId || resolvedDefaultModelId === settings.defaultModelId) {
      return;
    }
    setSettings(updateDefaultModelId(resolvedDefaultModelId));
  }, [resolvedDefaultModelId, setSettings, settings.defaultModelId]);

  return (
    <div className="space-y-5">
      <header className="space-y-3 rounded-xl border bg-card px-5 py-4">
        <h1 className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Settings2 />
          Preferences
        </h1>
        <p className="text-sm text-muted-foreground">Configure model, language, audio input, and automation behavior.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Default model and language settings.</CardDescription>
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
              value={settings.language}
              onChange={(event) => onLanguageChange(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Mic2 />
            Audio Input
          </CardTitle>
          <CardDescription>Select the preferred capture device.</CardDescription>
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
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
          <CardDescription>Toggle transcript post-processing options.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
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
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connectivity diagnostics</CardTitle>
          <CardDescription>Run a manual network check for model downloads.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {connectivityStatus === "offline" && <Badge variant="destructive">Status: Offline</Badge>}
            {connectivityStatus === "online" && <Badge variant="secondary">Status: Online</Badge>}
            {connectivityStatus === "unknown" && <Badge variant="outline">Status: Unknown</Badge>}
          </div>
          {connectivityDetail ? <p className="text-sm text-muted-foreground">{connectivityDetail}</p> : null}
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            variant="outline"
            onClick={() => void checkConnectivity()}
            disabled={isCheckingConnectivity}
          >
            {isCheckingConnectivity ? "Checking..." : "Check connectivity"}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <CardDescription>Review the active app data directory.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            App data: <code>{appDataDir}</code>
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
