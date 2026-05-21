use crate::domain::transcription_history::{
    ExportBundleZipResult, ImportTranscriptionsReport, ListTranscriptionsInput,
    SaveTranscriptionInput, TranscriptionHistoryStats, TranscriptionRecord,
    UpdateTranscriptionInput,
};
use crate::state::app_state::AppState;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn save_transcription(
    app: AppHandle,
    state: State<'_, AppState>,
    entry: SaveTranscriptionInput,
) -> Result<TranscriptionRecord, String> {
    state
        .transcription_store
        .save(&app, entry)
        .map_err(String::from)
}

#[tauri::command]
pub async fn list_transcriptions(
    app: AppHandle,
    state: State<'_, AppState>,
    params: Option<ListTranscriptionsInput>,
) -> Result<Vec<TranscriptionRecord>, String> {
    state
        .transcription_store
        .list(&app, params.unwrap_or(ListTranscriptionsInput {
            limit: Some(100),
            offset: Some(0),
            include_deleted: false,
            pinned_only: false,
            query: None,
        }))
        .map_err(String::from)
}

#[tauri::command]
pub async fn get_transcription(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<TranscriptionRecord, String> {
    state
        .transcription_store
        .get(&app, &id)
        .map_err(String::from)?
        .ok_or_else(|| String::from(crate::domain::app_error::AppError::NotFound(format!("transcription not found: {id}"))))
}

#[tauri::command]
pub async fn update_transcription(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    patch: UpdateTranscriptionInput,
) -> Result<TranscriptionRecord, String> {
    state
        .transcription_store
        .update(&app, &id, patch)
        .map_err(String::from)
}

#[tauri::command]
pub async fn delete_transcription(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    hard: Option<bool>,
) -> Result<(), String> {
    if hard.unwrap_or(false) {
        state
            .transcription_store
            .hard_delete(&app, &id)
            .map_err(String::from)
    } else {
        state
            .transcription_store
            .soft_delete(&app, &id)
            .map_err(String::from)
    }
}

#[tauri::command]
pub async fn restore_transcription(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state
        .transcription_store
        .restore(&app, &id)
        .map_err(String::from)
}

#[tauri::command]
pub async fn export_transcriptions(
    app: AppHandle,
    state: State<'_, AppState>,
    include_deleted: Option<bool>,
) -> Result<String, String> {
    state
        .transcription_store
        .export_json(&app, include_deleted.unwrap_or(true))
        .map_err(String::from)
}

#[tauri::command]
pub async fn import_transcriptions(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: String,
) -> Result<ImportTranscriptionsReport, String> {
    state
        .transcription_store
        .import_json(&app, &payload)
        .map_err(String::from)
}

#[tauri::command]
pub async fn export_transcriptions_csv(
    app: AppHandle,
    state: State<'_, AppState>,
    include_deleted: Option<bool>,
) -> Result<String, String> {
    state
        .transcription_store
        .export_csv(&app, include_deleted.unwrap_or(true))
        .map_err(String::from)
}

#[tauri::command]
pub async fn export_transcriptions_bundle_zip(
    app: AppHandle,
    state: State<'_, AppState>,
    include_deleted: Option<bool>,
) -> Result<ExportBundleZipResult, String> {
    state
        .transcription_store
        .export_bundle_zip(&app, include_deleted.unwrap_or(true))
        .map_err(String::from)
}

#[tauri::command]
pub async fn get_transcription_history_stats(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<TranscriptionHistoryStats, String> {
    state.transcription_store.stats(&app).map_err(String::from)
}

#[tauri::command]
pub async fn apply_history_retention(
    app: AppHandle,
    state: State<'_, AppState>,
    days: u32,
    include_pinned: Option<bool>,
) -> Result<usize, String> {
    state
        .transcription_store
        .apply_retention(&app, days, include_pinned.unwrap_or(false))
        .map_err(String::from)
}
