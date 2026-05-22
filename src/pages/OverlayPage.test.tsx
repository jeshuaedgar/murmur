import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { OverlayPage } from "@/pages/OverlayPage";
import type { AppStateValue } from "@/context/types/app-state";

const mockOnRecordToggle = vi.fn(async () => {});
const mockOnClearTranscript = vi.fn();
const mockSetSettings = vi.fn();
const mockCopyText = vi.fn(async () => {});

const baseState: AppStateValue = {
  models: [],
  installed: [],
  settings: {
    defaultModelId: "small",
    language: "auto",
    translate: false,
    autoCopy: false,
    autoPaste: true,
    startAtLogin: false,
    liveMode: true,
    audioInputDeviceId: null,
    cleanupEnabled: true,
    liveCleanupEnabled: true,
    liveCleanupMode: "rules",
    finalizeCleanupMode: "rules",
    cleanupLatencyBudgetMs: 200,
    cleanupShowRawToggle: false,
    cleanupBackend: "rules_only",
    cleanupModelId: null,
    historyRetentionDays: null,
    historyRetentionIncludePinned: false,
    overlayShortcut: "CmdOrCtrl+Shift+Space",
    overlayPinned: true,
    overlayHideStopsRecording: true,
    overlayEnabled: true,
  },
  transcript: "",
  rawTranscript: "",
  cleanupStrategy: "raw",
  status: "idle",
  appDataDir: "",
  settingsFilePath: "",
  isRecording: false,
  liveMode: true,
  activeTranscriptionTaskId: null,
  downloadProgress: new Map(),
  backendAudioInputs: [],
  browserAudioInputs: [],
  installedById: new Map(),
  setSettings: mockSetSettings,
  setTranscript: vi.fn(),
  setRawTranscript: vi.fn(),
  setCleanupStrategy: vi.fn(),
  setLiveMode: vi.fn(),
  setStatus: vi.fn(),
  startRecording: vi.fn(async () => {}),
  stopRecordingAndTranscribe: vi.fn(async () => {}),
  startFileTranscription: vi.fn(async () => {}),
  saveSettings: vi.fn(async () => {}),
  copyText: mockCopyText,
  downloadModel: vi.fn(async () => {}),
  deleteModel: vi.fn(async () => {}),
  cancelTranscription: vi.fn(async () => {}),
};

let mockState: AppStateValue = baseState;

class ResizeObserverMock {
  observe() {}
  disconnect() {}
  unobserve() {}
}

vi.mock("@/context/app-state", () => ({
  useAppState: () => mockState,
}));

vi.mock("@/features/transcription/hooks/use-home-actions", () => ({
  useHomeActions: () => ({
    onRecordToggle: mockOnRecordToggle,
    onClearTranscript: mockOnClearTranscript,
  }),
}));

describe("OverlayPage", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.clearAllMocks();
    mockState = {
      ...baseState,
      settings: {
        ...baseState.settings,
      },
    };
  });

  it("renders idle and transcribing labels", () => {
    const { rerender } = render(<OverlayPage />);
    expect(screen.getByText("Idle")).toBeInTheDocument();

    mockState = {
      ...mockState,
      status: "transcribing",
    };
    rerender(<OverlayPage />);
    expect(screen.getByText("Transcribing")).toBeInTheDocument();
  });

  it("shows hide-locked helper when overlay enabled", async () => {
    render(<OverlayPage />);

    fireEvent.click(screen.getByLabelText("Expand transcript panel"));

    expect(screen.getByText("Turn off Overlay Enabled in Settings to allow hide.")).toBeInTheDocument();
    expect(screen.getByLabelText("Hide overlay")).toBeDisabled();
  });

  it("calls primary action when record is pressed", async () => {
    render(<OverlayPage />);

    fireEvent.click(screen.getByRole("button", { name: "Start recording" }));

    expect(mockOnRecordToggle).toHaveBeenCalledTimes(1);
  });
});
