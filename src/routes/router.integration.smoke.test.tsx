import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { RouterProvider } from "@tanstack/react-router";
import { createAppRouter } from "@/routes/router";
import type { AppStateValue } from "@/context/types/app-state";

const mockState: AppStateValue = {
  models: [
    {
      id: "small",
      lab: "OpenAI Whisper",
      name: "Small",
      description: "Small model",
      url: "https://example.com/small.bin",
      fileName: "small.bin",
      recommended: true,
      fastest: false,
      bestQuality: false,
      sizeBytes: 1,
    },
  ],
  installed: [],
  settings: {
    defaultModelId: "small",
    language: "auto",
    translate: false,
    autoCopy: false,
    audioInputDeviceId: null,
  },
  transcript: "",
  status: "idle",
  appDataDir: "/tmp",
  isRecording: false,
  liveMode: true,
  activeTranscriptionTaskId: null,
  downloadProgress: new Map(),
  backendAudioInputs: [],
  browserAudioInputs: [],
  installedById: new Map(),
  setSettings: vi.fn(),
  setTranscript: vi.fn(),
  setLiveMode: vi.fn(),
  setStatus: vi.fn(),
  startRecording: vi.fn(async () => {}),
  stopRecordingAndTranscribe: vi.fn(async () => {}),
  startFileTranscription: vi.fn(async () => {}),
  saveSettings: vi.fn(async () => {}),
  copyText: vi.fn(async () => {}),
  downloadModel: vi.fn(async () => {}),
  deleteModel: vi.fn(async () => {}),
  cancelTranscription: vi.fn(async () => {}),
};

vi.mock("@/context/app-state", () => ({
  useAppState: () => mockState,
}));

describe("router integration smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderAt(path: string) {
    window.history.pushState({}, "", path);
    const router = createAppRouter();
    render(<RouterProvider router={router} />);
    await router.load();
  }

  it("renders /home", async () => {
    await renderAt("/home");
    await waitFor(() => expect(screen.getByText("Start Recording")).toBeInTheDocument());
  });

  it("renders /models", async () => {
    await renderAt("/models");
    await waitFor(() => expect(screen.getByText("Download once from Hugging Face, then run offline.")).toBeInTheDocument());
  });

  it("renders /settings", async () => {
    await renderAt("/settings");
    await waitFor(() => expect(screen.getByText("Default model")).toBeInTheDocument());
  });
});
