import { toast } from "sonner";
import { router } from "@/routes/router";

type ParsedError = {
  code?: string;
  title: string;
  description?: string;
};

type ToastLink = {
  label: string;
  to: "/models" | "/" | "/settings" | "/home";
};

type ToastOptions = {
  description?: string;
  link?: ToastLink;
};

function modelDownloadToastId(taskId: string) {
  return `model-download-${taskId}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseError(error: unknown, fallbackTitle = "Something went wrong"): ParsedError {
  if (typeof error === "string") {
    try {
      const parsed = JSON.parse(error);
      if (isObject(parsed)) {
        const code = typeof parsed.code === "string" ? parsed.code : undefined;
        const message = typeof parsed.message === "string" ? parsed.message : fallbackTitle;
        const detail = typeof parsed.detail === "string" ? parsed.detail : undefined;
        return { code, title: message, description: detail };
      }
    } catch {
      // not JSON
    }
    return { title: error };
  }

  if (error instanceof Error) {
    if (typeof error.message === "string") {
      try {
        const parsed = JSON.parse(error.message);
        if (isObject(parsed)) {
          const code = typeof parsed.code === "string" ? parsed.code : undefined;
          const message = typeof parsed.message === "string" ? parsed.message : fallbackTitle;
          const detail = typeof parsed.detail === "string" ? parsed.detail : undefined;
          return { code, title: message, description: detail };
        }
      } catch {
        // not JSON
      }
    }
    return { title: error.message || fallbackTitle };
  }

  if (isObject(error) && typeof error.message === "string") {
    return { title: error.message };
  }

  return { title: fallbackTitle };
}

function toSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const lower = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  const sentence = lower.charAt(0).toUpperCase() + lower.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

function buildUserMessage(error: unknown, fallbackTitle: string) {
  const parsed = parseError(error, fallbackTitle);
  const rawTitle = parsed.title.trim();
  const rawDescription = parsed.description?.trim();
  const lowerTitle = rawTitle.toLowerCase();
  const lowerDescription = (rawDescription ?? "").toLowerCase();
  const hasModelNotInstalled =
    parsed.code === "not_found" &&
    (lowerTitle.includes("not installed") || lowerDescription.includes("not installed"));

  if (hasModelNotInstalled) {
    return {
      title: "Model not installed.",
      description: "Install a model from the Models page, then try again.",
      statusMessage: "Model not installed. Open Models to install one.",
      link: { label: "Open Models", to: "/models" as const },
    };
  }

  if (lowerTitle.includes("download is incomplete")) {
    return {
      title: "Model download is incomplete.",
      description: "Open Models and reinstall the selected model before starting transcription.",
      statusMessage: "Model download is incomplete. Reinstall it from Models.",
      link: { label: "Open Models", to: "/models" as const },
    };
  }

  if (lowerTitle.includes("forbidden path") || lowerTitle.includes("not allowed on the scope")) {
    return {
      title: "Storage permission is restricted.",
      description: "Transcription still works, but saving recordings to disk is unavailable in this environment.",
      statusMessage: "Storage permission is restricted.",
    };
  }

  if (parsed.code === "unsupported_media") {
    return {
      title: "Unsupported audio format.",
      description: "Choose a WAV, MP3, or M4A file and try again.",
      statusMessage: "Unsupported audio format. Use WAV, MP3, or M4A.",
    };
  }

  if (parsed.code === "audio_decode_error") {
    return {
      title: "Audio file could not be decoded.",
      description: "The file may be corrupted or encoded in an unsupported variant.",
      statusMessage: "Audio file could not be decoded.",
    };
  }

  if (parsed.code === "missing_codec") {
    return {
      title: "Audio codec is unavailable.",
      description: "This build cannot decode that file's codec. Try exporting as WAV and import again.",
      statusMessage: "Audio codec unavailable in this build.",
    };
  }

  if (parsed.code === "io_error") {
    return {
      title: "Audio file could not be accessed.",
      description: "Check that the file still exists and this app has permission to read it.",
      statusMessage: "Audio file could not be accessed.",
    };
  }

  const title = toSentence(rawTitle || fallbackTitle);
  const description = rawDescription ? toSentence(rawDescription) : undefined;
  return {
    title,
    description,
    statusMessage: title,
  };
}

function toToastAction(link?: ToastLink) {
  if (!link) return undefined;
  return {
    label: link.label,
    onClick: () => {
      void router.navigate({ to: link.to });
    },
  };
}

export function toastError(error: unknown, fallbackTitle = "Something went wrong") {
  const message = buildUserMessage(error, fallbackTitle);
  toast.error(message.title, {
    description: message.description,
    action: toToastAction(message.link),
  });
}

export function getErrorMessage(error: unknown, fallbackTitle = "Something went wrong") {
  return buildUserMessage(error, fallbackTitle).statusMessage;
}

export function toastSuccess(message: string, descriptionOrOptions?: string | ToastOptions) {
  const options: ToastOptions =
    typeof descriptionOrOptions === "string" ? { description: descriptionOrOptions } : (descriptionOrOptions ?? {});
  toast.success(message, { description: options.description, action: toToastAction(options.link) });
}

export function toastInfo(message: string, descriptionOrOptions?: string | ToastOptions) {
  const options: ToastOptions =
    typeof descriptionOrOptions === "string" ? { description: descriptionOrOptions } : (descriptionOrOptions ?? {});
  toast.info(message, { description: options.description, action: toToastAction(options.link) });
}

export function toastWarning(message: string, descriptionOrOptions?: string | ToastOptions) {
  const options: ToastOptions =
    typeof descriptionOrOptions === "string" ? { description: descriptionOrOptions } : (descriptionOrOptions ?? {});
  toast.warning(message, { description: options.description, action: toToastAction(options.link) });
}

export function toastModelDownloadProgress(taskId: string, modelId: string, progressPct?: number) {
  const hasProgress = typeof progressPct === "number";
  const rounded = hasProgress ? Math.min(100, Math.max(0, Math.round(progressPct!))) : null;
  const description = rounded === null ? "Preparing download..." : `${rounded}% complete`;
  toast.loading(`Downloading ${modelId}`, {
    id: modelDownloadToastId(taskId),
    duration: Infinity,
    description,
    action: toToastAction({ label: "Open Models", to: "/models" }),
  });
}

export function toastModelDownloadComplete(taskId: string, modelId: string) {
  toast.success("Model installed", {
    id: modelDownloadToastId(taskId),
    description: modelId,
  });
}

export function toastModelDownloadFailed(taskId: string, error: unknown, fallbackTitle: string) {
  const message = buildUserMessage(error, fallbackTitle);
  toast.error(message.title, {
    id: modelDownloadToastId(taskId),
    description: message.description,
    action: toToastAction(message.link ?? { label: "Open Models", to: "/models" }),
  });
}
