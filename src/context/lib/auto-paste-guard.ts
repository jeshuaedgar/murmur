export function shouldApplyAutoPaste(completionIds: Set<string>, completionId: string, maxEntries = 100): boolean {
  if (completionIds.has(completionId)) {
    return false;
  }
  completionIds.add(completionId);
  if (completionIds.size > maxEntries) {
    const oldest = completionIds.values().next().value;
    if (oldest) {
      completionIds.delete(oldest);
    }
  }
  return true;
}
