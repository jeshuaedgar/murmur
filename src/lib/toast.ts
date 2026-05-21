import { toast } from "sonner";
import { router } from "@/routes/router";

type ParsedError = {
  code?: string;
  title: string;
  description?: string;
};

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
      action: {
        label: "Open Models",
        onClick: () => {
          void router.navigate({ to: "/models" });
        },
      },
    };
  }

  if (lowerTitle.includes("download is incomplete")) {
    return {
      title: "Model download is incomplete.",
      description: "Open Models and reinstall the selected model before starting transcription.",
      statusMessage: "Model download is incomplete. Reinstall it from Models.",
      action: {
        label: "Open Models",
        onClick: () => {
          void router.navigate({ to: "/models" });
        },
      },
    };
  }

  if (lowerTitle.includes("forbidden path") || lowerTitle.includes("not allowed on the scope")) {
    return {
      title: "Storage permission is restricted.",
      description: "Transcription still works, but saving recordings to disk is unavailable in this environment.",
      statusMessage: "Storage permission is restricted.",
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

export function toastError(error: unknown, fallbackTitle = "Something went wrong") {
  const message = buildUserMessage(error, fallbackTitle);
  toast.error(message.title, {
    description: message.description,
    action: message.action,
  });
}

export function getErrorMessage(error: unknown, fallbackTitle = "Something went wrong") {
  return buildUserMessage(error, fallbackTitle).statusMessage;
}

export function toastSuccess(message: string, description?: string) {
  toast.success(message, { description });
}
