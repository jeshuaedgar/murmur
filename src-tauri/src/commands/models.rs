use crate::domain::app_error::AppError;
use crate::domain::model_manifest::{InstalledModel, ModelInfo};
use crate::state::app_state::{AppState, DownloadTaskInfo};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[tauri::command]
pub fn list_models(state: State<'_, AppState>) -> Result<Vec<ModelInfo>, String> {
    Ok(state.manifest())
}

#[tauri::command]
pub fn get_installed_models(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<InstalledModel>, String> {
    state
        .model_manager
        .installed_models(&app)
        .map_err(String::from)
}

#[tauri::command]
pub async fn download_model(
    app: AppHandle,
    state: State<'_, AppState>,
    model_id: String,
) -> Result<DownloadTaskInfo, String> {
    let model = state.model_manager.get_model(&model_id).map_err(String::from)?;
    let model_path = state
        .model_manager
        .model_path(&app, &model_id)
        .map_err(String::from)?;

    let task_id = Uuid::new_v4().to_string();
    let cancel_flag = Arc::new(AtomicBool::new(false));

    {
        let mut flags = state.download_flags.lock().await;
        flags.insert(task_id.clone(), cancel_flag.clone());
    }

    let app_handle = app.clone();
    let task_id_for_task = task_id.clone();
    let model_id_for_task = model_id.clone();
    tauri::async_runtime::spawn(async move {
        let result = crate::services::downloader::download_to_file(
            app_handle.clone(),
            task_id_for_task.clone(),
            model_id_for_task.clone(),
            model.url,
            model_path,
            cancel_flag,
        )
        .await;

        match result {
            Ok(_) => {
                let _ = app_handle.emit(
                    "model-download-complete",
                    serde_json::json!({ "taskId": task_id_for_task, "modelId": model_id_for_task }),
                );
            }
            Err(e) => {
                let _ = app_handle.emit(
                    "model-download-error",
                    serde_json::json!({ "taskId": task_id_for_task, "modelId": model_id_for_task, "error": e.to_string() }),
                );
            }
        }
    });

    Ok(DownloadTaskInfo {
        task_id,
        model_id,
        status: "queued".to_string(),
    })
}

#[tauri::command]
pub async fn cancel_download(state: State<'_, AppState>, task_id: String) -> Result<(), String> {
    let flags = state.download_flags.lock().await;
    if let Some(flag) = flags.get(&task_id) {
        flag.store(true, Ordering::Relaxed);
        Ok(())
    } else {
        Err(String::from(AppError::NotFound(format!(
            "download task not found: {}",
            task_id
        ))))
    }
}

#[tauri::command]
pub fn delete_model(
    app: AppHandle,
    state: State<'_, AppState>,
    model_id: String,
) -> Result<(), String> {
    state
        .model_manager
        .delete_model(&app, &model_id)
        .map_err(String::from)
}
