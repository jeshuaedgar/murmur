import { describe, expect, it } from "vitest";
import type { InstalledModel, ModelInfo } from "@/lib/types/models";
import {
  buildModelOptionsByLab,
  resolveInstalledDefaultModelId,
} from "@/features/settings/hooks/use-settings-page-logic";

const MODELS: ModelInfo[] = [
  {
    id: "distil-small.en",
    lab: "Distil-Whisper",
    name: "Distil Small.en",
    description: "",
    url: "",
    fileName: "",
    recommended: false,
    fastest: false,
    bestQuality: false,
  },
  {
    id: "small",
    lab: "OpenAI Whisper",
    name: "Small",
    description: "",
    url: "",
    fileName: "",
    recommended: false,
    fastest: false,
    bestQuality: false,
  },
  {
    id: "large-v3",
    lab: "OpenAI Whisper",
    name: "Large V3",
    description: "",
    url: "",
    fileName: "",
    recommended: false,
    fastest: false,
    bestQuality: false,
  },
];

function toInstalledById(installed: InstalledModel[]): Map<string, InstalledModel> {
  return new Map(installed.map((item) => [item.id, item]));
}

describe("useSettingsPageLogic helpers", () => {
  it("groups models by lab using shared lab order index", () => {
    const installedById = toInstalledById([{ id: "small", installed: true }]);
    const grouped = buildModelOptionsByLab(MODELS, installedById);

    expect(grouped.map((group) => group.lab)).toEqual(["OpenAI Whisper", "Distil-Whisper"]);
    expect(grouped[0].options.map((option) => option.id)).toEqual(["small", "large-v3"]);
  });

  it("marks non-installed models as disabled", () => {
    const installedById = toInstalledById([{ id: "small", installed: true }]);
    const grouped = buildModelOptionsByLab(MODELS, installedById);
    const flattened = grouped.flatMap((group) => group.options);

    expect(flattened.find((option) => option.id === "small")?.disabled).toBe(false);
    expect(flattened.find((option) => option.id === "distil-small.en")?.disabled).toBe(true);
    expect(flattened.find((option) => option.id === "large-v3")?.disabled).toBe(true);
  });

  it("resolves to first installed model when default is not installed", () => {
    const installedById = toInstalledById([{ id: "small", installed: true }]);

    expect(resolveInstalledDefaultModelId("large-v3", MODELS, installedById)).toBe("small");
  });

  it("returns null when no model is installed", () => {
    const installedById = toInstalledById([]);

    expect(resolveInstalledDefaultModelId("large-v3", MODELS, installedById)).toBeNull();
  });
});
