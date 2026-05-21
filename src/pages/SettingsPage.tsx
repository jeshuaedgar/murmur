import { Button } from "@/components/ui/button";
import { Mic2, Save, Settings2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAppState } from "@/context/app-state";
import { useSettingsPageLogic } from "@/features/settings/hooks/use-settings-page-logic";

export function SettingsPage() {
  const {
    settings,
    models,
    browserAudioInputs,
    backendAudioInputs,
    appDataDir,
    setSettings,
    saveSettings,
  } = useAppState();
  const {
    modelOptions,
    browserInputOptions,
    audioInputsSummary,
    onDefaultModelChange,
    onLanguageChange,
    onAudioInputChange,
    onTranslateChange,
    onAutoCopyChange,
    onSaveSettings,
  } = useSettingsPageLogic({
    models,
    browserAudioInputs,
    backendAudioInputs,
    setSettings,
    saveSettings,
  });

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="inline-flex items-center gap-2">
          <Settings2 />
          Preferences
        </h1>
        <p>Configure model, language, and capture behavior.</p>
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
              value={settings.defaultModelId}
              onValueChange={onDefaultModelChange}
            >
              <SelectTrigger id="default-model" className="w-full">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {modelOptions.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
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
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="flex items-center gap-2 px-3 py-2">
            <Switch
              id="translate"
              checked={settings.translate}
              onCheckedChange={onTranslateChange}
            />
            <Label htmlFor="translate">Translate to English</Label>
          </div>

          <div className="flex items-center gap-2 px-3 py-2">
            <Switch
              id="autocopy"
              checked={settings.autoCopy}
              onCheckedChange={onAutoCopyChange}
            />
            <Label htmlFor="autocopy">Auto-copy transcript</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <CardDescription>Review the active app data directory.</CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p>
            App data: <code>{appDataDir}</code>
          </p>
          <Button onClick={() => void onSaveSettings()}>
            <Save />
            Save settings
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
