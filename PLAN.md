# Whisper Local STT — Product Plan

This file tracks the roadmap from MVP to a polished, production-quality cross-platform speech-to-text app.

Legend:
- `[x]` Done
- `[ ]` Not done

## 1) Foundation and Architecture

- [x] Tauri 2 desktop shell initialized
- [x] Rust backend command surface established
- [x] TypeScript frontend integrated with Tauri invoke API
- [x] Layered backend structure (`commands`, `services`, `domain`, `state`)
- [x] Typed frontend API wrappers for Tauri commands
- [x] Basic architecture documentation (`ARCHITECTURE.md`)
- [ ] Add internal ADRs for key technical decisions (audio stack, model strategy, packaging policy)
- [ ] Add strict linting + formatting gates for TS and Rust (`eslint`, `prettier`, `clippy`, `rustfmt`)
- [ ] Add CI pipeline for build/test/lint across OS matrix

## 2) Model Catalog and Local Model Management

- [x] Built-in model manifest with core Whisper models (`base`, `small`, `medium`, `large-v3`)
- [x] In-app model listing UI
- [x] In-app model install/download action
- [x] Model files stored in app data directory
- [x] Installed model detection by file presence
- [x] Model delete action
- [x] Download progress events surfaced to UI
- [x] URL allowlist restriction for model downloads
- [x] Offline reuse of installed models
- [ ] Verify/checkpoint model integrity (hash validation)
- [ ] Resume interrupted downloads
- [ ] Add model metadata refresh/versioning strategy
- [ ] Add model uninstall size accounting and cache cleanup UX
- [ ] Add optional advanced model list (quantized variants)

## 3) Transcription Engine and Job Orchestration

- [x] Local transcription integration via `whisper-rs` / `whisper.cpp`
- [x] Model load and reuse cache in backend service
- [x] File transcription command
- [x] Recording transcription command
- [x] PCM transcription command for live mode
- [x] Background job API for file transcription
- [x] Transcription progress events (`queued`, `preparing_audio`, `transcribing`)
- [x] Transcription cancellation API
- [x] UI support for canceling active transcription jobs
- [x] Typed error propagation to frontend
- [ ] Add per-job timeout controls and user-visible timeout settings
- [ ] Add queue management (multi-job queue, reorder, cancel queued)
- [ ] Add parallelism controls (single active model lock vs multi-process)
- [ ] Add richer progress metrics (elapsed time, estimated remaining, audio duration)
- [ ] Add robust crash-safe cleanup for in-flight job temp artifacts

## 4) Audio Input, Recording, and Conversion Pipeline

- [x] Microphone recording flow in app
- [x] Live chunked transcription during recording
- [x] Final transcription pass after recording stops
- [x] Real backend input device enumeration (`cpal`)
- [x] Device selection UI (browser-side device IDs)
- [x] Persist selected audio input in settings
- [x] WAV decode + mono + 16 kHz normalization path
- [x] Add MP3 import support
- [x] Add M4A/AAC import support
- [ ] Add FLAC/OGG import support
- [ ] Add robust transcoding strategy (Rust-native first, optional ffmpeg fallback)
- [ ] Add recording quality controls (sample rate / channel policy)
- [ ] Add silence detection and auto-stop
- [ ] Add VAD-based chunking to improve live transcription quality
- [ ] Add input level meter + clipping warnings
- [ ] Add audio input diagnostics screen (permissions, sample format, latency)

## 5) Transcript UX and Editor Experience

- [x] Transcript display area
- [x] Copy transcript action
- [x] Clear transcript action
- [x] Status bar / state text updates
- [x] Auto-copy option
- [ ] Save/export transcript to TXT/MD/JSON
- [ ] Segment/timestamp view with click-to-jump
- [ ] Transcript history list with searchable sessions
- [ ] Rename/tag sessions
- [ ] Undo/redo + edit tooling for transcript text
- [ ] Quick cleanup actions (punctuation, casing, filler removal)
- [ ] Configurable replacement dictionary / custom commands

## 6) Settings, Preferences, and Onboarding

- [x] Persisted settings file in app data
- [x] Default model setting
- [x] Language setting (`auto` or explicit)
- [x] Translate toggle
- [x] Audio input selection setting
- [x] App data path visibility
- [ ] First-run onboarding (explain local-first model download + offline behavior)
- [ ] Recommended defaults wizard based on hardware profile
- [ ] Settings reset / import / export
- [ ] Advanced settings panel (threads, beam/greedy params, live chunk interval)
- [ ] Privacy settings page (logs, retention, diagnostics)

## 7) Global Productivity Features

- [ ] Global push-to-talk hotkey
- [ ] Global toggle recording hotkey
- [ ] Optional always-on-top mini overlay window
- [x] Start at login
- [x] Tray menu controls (v1: Show/Hide + Quit)
- [ ] Tray quick record/stop controls
- [ ] Paste-to-active-app action after transcription
- [ ] Clipboard history integration (optional)

## 8) Reliability, Error Handling, and Observability

- [x] Typed Rust error model
- [x] User-facing status/error messages in UI
- [x] Non-blocking UI during download/transcription
- [ ] Standardize error codes and map all failure modes to docs
- [ ] Add structured logging (`tracing`) with log levels
- [ ] Add redaction policy (no transcript content in non-debug logs)
- [ ] Add panic/report hooks with local crash reports
- [ ] Add health checks for model load failures and recovery prompts
- [ ] Add automatic retry policy for transient network download errors

## 9) Privacy and Security Hardening

- [x] Local-only transcription runtime
- [x] No cloud inference dependency for core use
- [x] HTTPS model download source with allowlist
- [x] App-data scoped model storage
- [ ] Add checksum/signature verification for model artifacts
- [ ] Add optional encrypted local transcript store
- [ ] Add explicit privacy statement in app and README
- [ ] Threat model doc (path traversal, malicious file input, logging leakage)
- [ ] Harden file import validation and size limits

## 10) Testing and Quality Assurance

- [x] Frontend production build passing
- [x] Rust compile checks passing
- [ ] Unit tests for model manager behavior
- [ ] Unit tests for downloader edge cases (network timeout, interruption, cleanup)
- [ ] Unit tests for audio conversion/resampling correctness
- [ ] Integration tests for command flows
- [ ] Cross-platform manual QA checklist (Windows/macOS/Linux)
- [ ] Golden-file transcription smoke tests with sample audio fixtures
- [ ] Performance regression benchmarks (latency/memory per model)

## 11) Packaging, Distribution, and Release Ops

- [x] macOS app bundle build verified
- [x] DMG generation works (manual script invocation)
- [ ] Stabilize one-command release packaging across targets
- [ ] Windows installer packaging and validation (`msi`/`exe`)
- [ ] Linux package outputs (`AppImage`, `deb`, optionally `rpm`)
- [ ] Validate tray dependencies on Linux (`libappindicator` family where required)
- [ ] Add Flatpak tray temp-dir config (`temp_dir_path` -> app cache) and verify permissions
- [ ] Code signing pipeline (macOS + Windows)
- [ ] macOS notarization workflow
- [ ] Auto-updater integration with signed artifacts
- [ ] Release checklist + rollback plan

## 12) Documentation and Open Source Readiness

- [x] Setup/build README
- [x] Architecture note
- [x] Plan tracking file (`PLAN.md`)
- [ ] Add `LICENSE` (MIT or Apache-2.0)
- [ ] Add `CONTRIBUTING.md`
- [ ] Add `CODE_OF_CONDUCT.md`
- [ ] Add issue/PR templates
- [ ] Add troubleshooting playbook per platform
- [ ] Publish roadmap milestones and “good first issue” labels

## 13) Recommended Next Milestones

### Milestone A — “MVP Complete”
- [x] MP3/M4A import support
- [ ] Save/export transcript
- [ ] First-run onboarding
- [ ] Unit tests for model manager/downloader/audio conversion
- [ ] Cross-platform QA pass on Windows/macOS/Linux

### Milestone B — “Daily Driver”
- [ ] Global hotkeys + tray controls
- [ ] Transcript history + timestamps
- [ ] Silence/VAD auto-stop
- [ ] Structured logging + robust error mapping
- [ ] Stable packaging scripts for all targets

### Milestone C — “Production Release 1.0”
- [ ] Signing + notarization + updater
- [ ] Security hardening and checksum validation
- [ ] Full docs suite and contributor workflows
- [ ] CI matrix with release automation
- [ ] Performance tuning and benchmark guardrails

## 14) Immediate Recommendation (What to build next)

Priority order for highest product impact:

1. MP3/M4A import support (removes biggest user friction)
2. Save/export transcript + transcript history
3. Global hotkey + tray quick controls
4. Test coverage for model/download/audio core
5. Cross-platform packaging/signing pipeline

## 15) Overlay UX Redesign and Interaction Plan (Current Priority)

This section scopes the active redesign work for the Tauri + React overlay while preserving existing behavior:
- global hotkey starts/stops transcription (does not toggle overlay visibility)
- `overlayEnabled` keeps overlay available/present
- backend commands/settings compatibility remains intact unless a blocker is discovered

Legend:
- `[x]` Done
- `[ ]` Not done

### A) Visual Form and Information Hierarchy

- [ ] Convert overlay to compact icon/pill presentation as default footprint
- [ ] Add expanded transcript panel on demand without losing compact quick-access mode
- [ ] Prioritize primary action (record/stop) visually over pin/close secondary controls
- [ ] Clarify state hierarchy with explicit labeled states: `Idle`, `Recording`, `Transcribing`, `Done`, `Error`
- [ ] Improve microcopy for each state and transition edge case

### B) Active Transcribing Motion and Waveform

- [ ] Install ElevenLabs UI waveform component via `npx @elevenlabs/cli@latest components add waveform`
- [ ] Verify component setup and styling compatibility with existing UI system
- [ ] Integrate waveform animation into compact overlay while `Transcribing` is active
- [ ] Add reduced-motion fallback and avoid noisy animation loops

### C) Transcript Completion and Auto-Paste

- [ ] Auto-paste transcribed text to active target immediately after completion
- [ ] Preserve existing hotkey and transcription lifecycle behavior
- [ ] Keep completion transcript visible in overlay (`Done`) until next recording or clear
- [ ] Guard against duplicate auto-paste on repeated completion events

### D) Controls and Overlay Enabled Semantics

- [ ] Keep hide/close affordance available but de-emphasized versus primary action
- [ ] Make disabled close/hide behavior explicit when `overlayEnabled` prevents hiding
- [ ] Add tooltip/inline helper copy explaining why close is unavailable
- [ ] Maintain pin behavior and improve control spacing/hit targets

### E) Accessibility and Keyboard

- [ ] Validate keyboard focus order in compact and expanded modes
- [ ] Ensure Enter/Space trigger primary action and Escape follows overlay policy
- [ ] Add ARIA labels for all control buttons and waveform context
- [ ] Add `aria-live` announcements for state changes (`polite`) and errors (`assertive`)
- [ ] Validate color contrast across all states (especially Recording/Error)

### F) Code Quality and Regression Safety

- [ ] Refactor overlay state rendering to a single maintainable state-to-UI mapping
- [ ] Keep non-overlay routes untouched and verify no cross-route regressions
- [ ] Add/update component/integration tests for all core overlay states
- [ ] Add tests for auto-paste completion flow and disabled hide behavior
- [ ] Keep build/test/cargo checks green

### G) Verification Checklist (Must Run)

- [ ] `npm run test`
- [ ] `npm run build`
- [ ] `cargo check` (run in `src-tauri`)

### H) Execution Order

1. Implement compact pill/icon shell and control hierarchy.
2. Integrate waveform animation for active transcribing state.
3. Add completion auto-paste and dedupe safeguards.
4. Finalize accessibility labels/live regions and keyboard behavior.
5. Update tests, then run full verification (`test`, `build`, `cargo check`).
