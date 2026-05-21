import type { ModelInfo } from "@/lib/types/models";

const LAB_ORDER_INDEX: Record<string, number> = {
  "OpenAI Whisper": 0,
  "Distil-Whisper": 1,
};

export function getLabOrderIndex(lab: string): number {
  return LAB_ORDER_INDEX[lab] ?? Number.MAX_SAFE_INTEGER;
}

export function compareLabs(a: string, b: string): number {
  const byIndex = getLabOrderIndex(a) - getLabOrderIndex(b);
  if (byIndex !== 0) return byIndex;
  return a.localeCompare(b);
}

export function groupModelsByLab(models: ModelInfo[]): Array<[string, ModelInfo[]]> {
  const grouped = new Map<string, ModelInfo[]>();
  for (const model of models) {
    const current = grouped.get(model.lab) ?? [];
    grouped.set(model.lab, [...current, model]);
  }
  return Array.from(grouped.entries()).sort(([a], [b]) => compareLabs(a, b));
}
