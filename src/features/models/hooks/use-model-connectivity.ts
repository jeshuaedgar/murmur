import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/tauri";
import { isTauriRuntime } from "@/lib/runtime/tauri";
import { getErrorMessage, toastError, toastInfo, toastSuccess, toastWarning } from "@/lib/toast";

export type ModelConnectivityState = {
  connectivityStatus: "unknown" | "online" | "offline";
  connectivityDetail: string;
  isCheckingConnectivity: boolean;
  checkConnectivity: () => Promise<boolean>;
};

export function useModelConnectivity(): ModelConnectivityState {
  const [isCheckingConnectivity, setIsCheckingConnectivity] = useState(false);
  const [connectivityStatus, setConnectivityStatus] = useState<"unknown" | "online" | "offline">("unknown");
  const [connectivityDetail, setConnectivityDetail] = useState("");

  useEffect(() => {
    const markOffline = () => {
      setConnectivityStatus("offline");
      setConnectivityDetail("No internet connection detected.");
    };
    const markUnknown = () => {
      setConnectivityStatus("unknown");
      setConnectivityDetail("");
    };

    if (!navigator.onLine) {
      markOffline();
    }

    window.addEventListener("offline", markOffline);
    window.addEventListener("online", markUnknown);
    return () => {
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("online", markUnknown);
    };
  }, []);

  const checkConnectivity = useCallback(async () => {
    setIsCheckingConnectivity(true);
    try {
      if (!navigator.onLine) {
        setConnectivityStatus("offline");
        setConnectivityDetail("No internet connection detected.");
        toastWarning("Offline", "No internet connection detected.");
        return false;
      }
      if (!isTauriRuntime) {
        setConnectivityStatus("online");
        setConnectivityDetail("Browser reports online.");
        toastInfo("Connectivity check", "Browser reports online.");
        return true;
      }

      const status = await api.checkHuggingFaceConnectivity();
      const reachable = status.online && status.huggingfaceReachable;
      setConnectivityStatus(reachable ? "online" : "offline");
      setConnectivityDetail(
        reachable
          ? "Connected to Hugging Face."
          : getErrorMessage(status.detail, "No internet or Hugging Face is unreachable."),
      );
      if (reachable) {
        toastSuccess("Connectivity check passed", "Connected to Hugging Face.");
      } else {
        toastWarning("Connectivity issue", getErrorMessage(status.detail, "Hugging Face is unreachable."));
      }
      return reachable;
    } catch (error) {
      setConnectivityStatus("offline");
      setConnectivityDetail(getErrorMessage(error, "No internet or Hugging Face is unreachable."));
      toastError(error, "Connectivity check failed");
      return false;
    } finally {
      setIsCheckingConnectivity(false);
    }
  }, []);

  return {
    connectivityStatus,
    connectivityDetail,
    isCheckingConnectivity,
    checkConnectivity,
  };
}
