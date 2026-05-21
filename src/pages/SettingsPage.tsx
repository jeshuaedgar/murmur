import { Button } from "@/components/ui/button";
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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Default model</Label>
          <Select
            value={settings.defaultModelId}
            onValueChange={(value) => setSettings((prev) => ({ ...prev, defaultModelId: value }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {models.map((model) => (
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
            onChange={(event) => setSettings((prev) => ({ ...prev, language: event.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-2 md:col-span-2">
          <Label>Audio input device</Label>
          <Select
            value={settings.audioInputDeviceId ?? ""}
            onValueChange={(value) => setSettings((prev) => ({ ...prev, audioInputDeviceId: value || null }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select input" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {browserAudioInputs.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Detected by browser: {browserAudioInputs.length} • Detected by backend: {backendAudioInputs.length}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="translate"
            checked={settings.translate}
            onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, translate: checked }))}
          />
          <Label htmlFor="translate">Translate to English</Label>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="autocopy"
            checked={settings.autoCopy}
            onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, autoCopy: checked }))}
          />
          <Label htmlFor="autocopy">Auto-copy transcript</Label>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        App data: <code>{appDataDir}</code>
      </p>
      <div>
        <Button onClick={() => void saveSettings()}>Save settings</Button>
      </div>
    </div>
  );
}
