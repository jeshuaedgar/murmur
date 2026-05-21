use crate::services::app_paths;
use crate::state::app_state::AppSettings;
use tauri::AppHandle;

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    let path = app_paths::settings_path(&app).map_err(String::from)?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    serde_json::from_slice(&bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = app_paths::settings_path(&app).map_err(String::from)?;
    let body = serde_json::to_vec_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(path, body).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_app_data_dir(app: AppHandle) -> Result<String, String> {
    app_paths::app_data_dir(&app)
        .map(|v| v.to_string_lossy().to_string())
        .map_err(String::from)
}
