use crate::domain::app_error::AppError;
use crate::domain::transcription_result::{TranscriptionOptions, TranscriptionResult};
use crate::services::audio_convert;
use crate::state::app_state::AppState;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn transcribe_file(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    options: TranscriptionOptions,
) -> Result<TranscriptionResult, String> {
    let model_path = state
        .model_manager
        .model_path(&app, &options.model_id)
        .map_err(String::from)?;

    if !model_path.exists() {
        return Err(String::from(AppError::NotFound(format!(
            "model '{}' is not installed",
            options.model_id
        ))));
    }

    let audio = audio_convert::load_audio_as_mono_f32_16khz(&path).map_err(String::from)?;

    let result = state
        .whisper_service
        .transcribe_audio(&options.model_id, model_path, audio, &options)
        .map_err(String::from)?;

    if result.text.is_empty() {
        return Err(String::from(AppError::Engine(
            "transcription completed but no text was produced".to_string(),
        )));
    }

    Ok(result)
}

#[tauri::command]
pub async fn transcribe_recording(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    options: TranscriptionOptions,
) -> Result<TranscriptionResult, String> {
    transcribe_file(app, state, path, options).await
}
