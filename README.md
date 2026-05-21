# Murmur (Tauri 2)

Local-first, cross-platform speech-to-text desktop app using Tauri 2 + Rust + TypeScript with `whisper.cpp` through `whisper-rs`.

## What works in this MVP

- Tauri 2 desktop shell with Rust command layer.
- Built-in model catalog (`base`, `small`, `medium`, `large-v3`).
- In-app model download from Hugging Face (`ggerganov/whisper.cpp`).
- Download progress events and install state checks.
- Models stored in platform app data under `models/whisper`.
- Offline reuse of installed models.
- WAV file transcription locally.
- Microphone recording path (browser capture -> live chunk transcription + final local WAV transcription).
- Audio input device selection in Settings (persisted).
- File transcription job progress events with cancellation.
- Settings persistence (default model, language, translate, auto-copy).

## Repository layout

- `src/` TypeScript UI.
- `src-tauri/src/commands/` Tauri command API.
- `src-tauri/src/services/` downloader, model manager, whisper integration, audio conversion.
- `src-tauri/src/domain/` shared domain types + typed errors.
- `src-tauri/src/state/` shared app state.

## Requirements

- Node.js 18+.
- Rust toolchain (`rustup`, `cargo`).
- Tauri prerequisites for target OS: <https://tauri.app/start/prerequisites/>.

## Setup

```bash
npm install
npm run tauri dev
```

## Build packages

```bash
npm run tauri build
```

Tauri produces platform-native artifacts (`.app`, `.msi`/`.exe`, `.AppImage`/`.deb` depending on host/targets).

## Privacy model

- Audio is transcribed locally via `whisper.cpp` through `whisper-rs`.
- No transcription API or cloud service is required.
- Models are downloaded via HTTPS from allowlisted Hugging Face URLs.

## Model storage

Models are stored in app data and managed automatically:

- macOS: `~/Library/Application Support/<bundle-id>/models/whisper`
- Linux: `~/.local/share/<bundle-id>/models/whisper`
- Windows: `%AppData%/<bundle-id>/models/whisper`

(Exact path is available in Settings view.)

## Known MVP limitations

- Audio import is WAV-first. MP3/M4A transcoding is not yet added.
- Audio input device enumeration is currently a placeholder.
- Download resume support is not implemented yet.
- Global hotkey and start-on-login are not implemented yet.
- `whisper-rs` integration should be validated on each target OS with native Rust toolchains.
- Live mode currently re-transcribes buffered audio every 2 seconds (functional MVP, not token-level streaming).

## Troubleshooting

- If transcription fails with "model not installed", install a model from Models view.
- If recording fails, grant microphone permissions to the app.
- If model download fails offline, connect once to install, then use fully offline.

## Packaging notes

### macOS

- Add microphone usage descriptions to app plist as needed.
- For distribution, complete signing + notarization pipeline.

### Windows

- Validate microphone permissions and SmartScreen/signing behavior.

### Linux

- Validate audio input behavior across PulseAudio/PipeWire environments.

## License

Choose and add `MIT` or `Apache-2.0` before publishing.
