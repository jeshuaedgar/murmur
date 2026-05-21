use crate::domain::app_error::AppError;
use crate::domain::transcription_result::{TranscriptionOptions, TranscriptionResult};
use crate::services::audio_convert;
use crate::state::app_state::AppState;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionTaskInfo {
    pub task_id: String,
    pub status: String,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionProgressEvent {
    pub task_id: String,
    pub stage: String,
    pub message: String,
}

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

#[tauri::command]
pub async fn transcribe_pcm(
    app: AppHandle,
    state: State<'_, AppState>,
    samples: Vec<f32>,
    sample_rate: u32,
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

    if samples.is_empty() {
        return Err(String::from(AppError::InvalidInput(
            "cannot transcribe empty PCM sample buffer".to_string(),
        )));
    }

    let audio = audio_convert::normalize_mono_to_16khz(samples, sample_rate);
    let result = state
        .whisper_service
        .transcribe_audio(&options.model_id, model_path, audio, &options)
        .map_err(String::from)?;

    Ok(result)
}

#[tauri::command]
pub async fn start_transcription_file(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
    options: TranscriptionOptions,
) -> Result<TranscriptionTaskInfo, String> {
    let task_id = Uuid::new_v4().to_string();
    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let mut flags = state.transcription_flags.lock().await;
        flags.insert(task_id.clone(), cancel_flag.clone());
    }

    let app_handle = app.clone();
    let state_ref = state.inner().model_manager.clone();
    let whisper_service = state.inner().whisper_service.clone();
    let task_id_for_task = task_id.clone();
    tauri::async_runtime::spawn(async move {
        let _ = app_handle.emit(
            "transcription-progress",
            TranscriptionProgressEvent {
                task_id: task_id_for_task.clone(),
                stage: "queued".to_string(),
                message: "Transcription queued".to_string(),
            },
        );

        if cancel_flag.load(Ordering::Relaxed) {
            let _ = app_handle.emit(
                "transcription-canceled",
                serde_json::json!({ "taskId": task_id_for_task }),
            );
            cleanup_transcription_flag(&app_handle, &task_id_for_task).await;
            return;
        }

        let _ = app_handle.emit(
            "transcription-progress",
            TranscriptionProgressEvent {
                task_id: task_id_for_task.clone(),
                stage: "preparing_audio".to_string(),
                message: "Preparing audio".to_string(),
            },
        );

        let model_path = match state_ref.model_path(&app_handle, &options.model_id) {
            Ok(path) => path,
            Err(err) => {
                let _ = app_handle.emit(
                    "transcription-error",
                    serde_json::json!({ "taskId": task_id_for_task, "error": err.to_string() }),
                );
                cleanup_transcription_flag(&app_handle, &task_id_for_task).await;
                return;
            }
        };
        if !model_path.exists() {
            let _ = app_handle.emit(
                "transcription-error",
                serde_json::json!({
                    "taskId": task_id_for_task,
                    "error": format!("model '{}' is not installed", options.model_id),
                }),
            );
            cleanup_transcription_flag(&app_handle, &task_id_for_task).await;
            return;
        }

        let audio = match audio_convert::load_audio_as_mono_f32_16khz(&path) {
            Ok(audio) => audio,
            Err(err) => {
                let _ = app_handle.emit(
                    "transcription-error",
                    serde_json::json!({ "taskId": task_id_for_task, "error": err.to_string() }),
                );
                cleanup_transcription_flag(&app_handle, &task_id_for_task).await;
                return;
            }
        };

        if cancel_flag.load(Ordering::Relaxed) {
            let _ = app_handle.emit(
                "transcription-canceled",
                serde_json::json!({ "taskId": task_id_for_task }),
            );
            return;
        }

        let _ = app_handle.emit(
            "transcription-progress",
            TranscriptionProgressEvent {
                task_id: task_id_for_task.clone(),
                stage: "transcribing".to_string(),
                message: "Running local model".to_string(),
            },
        );

        match whisper_service.transcribe_audio(&options.model_id, model_path, audio, &options) {
            Ok(result) => {
                let _ = app_handle.emit(
                    "transcription-complete",
                    serde_json::json!({ "taskId": task_id_for_task, "result": result }),
                );
            }
            Err(err) => {
                let _ = app_handle.emit(
                    "transcription-error",
                    serde_json::json!({ "taskId": task_id_for_task, "error": err.to_string() }),
                );
            }
        }
        cleanup_transcription_flag(&app_handle, &task_id_for_task).await;
    });

    Ok(TranscriptionTaskInfo {
        task_id,
        status: "queued".to_string(),
    })
}

async fn cleanup_transcription_flag(app: &AppHandle, task_id: &str) {
    let state = app.state::<AppState>();
    let mut flags = state.transcription_flags.lock().await;
    flags.remove(task_id);
}

#[tauri::command]
pub async fn cancel_transcription(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<(), String> {
    let flags = state.transcription_flags.lock().await;
    if let Some(flag) = flags.get(&task_id) {
        flag.store(true, Ordering::Relaxed);
        Ok(())
    } else {
        Err(String::from(AppError::NotFound(format!(
            "transcription task not found: {task_id}"
        ))))
    }
}
