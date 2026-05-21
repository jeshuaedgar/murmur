# Architecture Note

## Command flow

1. UI calls typed wrappers in `src/lib/api/tauri.ts`.
2. Tauri commands in Rust receive requests and validate inputs.
3. Services handle side effects:
4. `model_manager` resolves manifest + install paths.
5. `downloader` performs streamed HTTPS downloads with progress events.
6. `audio_convert` loads WAV and normalizes to mono 16 kHz float samples.
7. `whisper_service` loads/reuses model context and runs local transcription.
8. Result and errors are returned to UI as typed payloads.

## State management

- Frontend keeps minimal in-memory UI state (active tab, status, transcript, progress map).
- Backend shared state (`AppState`) owns:
- model manifest manager
- whisper model cache
- active download cancellation flags

## Offline behavior

- After model install, transcription uses local model files only.
- No network calls are required for local transcription runs.

## Error strategy

- Rust services return typed `AppError` values.
- Commands map them to structured string payloads for frontend display/logging.
