import { useCallback, useMemo, useState } from "react";
import type { ModelInfo } from "@/lib/types/models";

type UseModelActionsArgs = {
  models: ModelInfo[];
  downloadModel: (modelId: string) => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  checkConnectivity: () => Promise<boolean>;
};

export function useModelActions({ models, downloadModel, deleteModel, checkConnectivity }: UseModelActionsArgs) {
  const [pendingRemoveModelId, setPendingRemoveModelId] = useState<string | null>(null);

  const pendingModel = useMemo(
    () => models.find((model) => model.id === pendingRemoveModelId) ?? null,
    [models, pendingRemoveModelId],
  );

  const openRemoveConfirmation = useCallback((modelId: string) => {
    setPendingRemoveModelId(modelId);
  }, []);

  const closeRemoveConfirmation = useCallback(() => {
    setPendingRemoveModelId(null);
  }, []);

  const confirmRemove = useCallback(async () => {
    if (!pendingRemoveModelId) {
      return;
    }
    await deleteModel(pendingRemoveModelId).catch(() => undefined);
    setPendingRemoveModelId(null);
  }, [deleteModel, pendingRemoveModelId]);

  const handleDownload = useCallback(
    async (modelId: string) => {
      const isConnected = await checkConnectivity();
      if (!isConnected) {
        return;
      }
      await downloadModel(modelId);
    },
    [checkConnectivity, downloadModel],
  );

  return {
    pendingRemoveModelId,
    pendingModel,
    openRemoveConfirmation,
    closeRemoveConfirmation,
    confirmRemove,
    handleDownload,
  };
}
