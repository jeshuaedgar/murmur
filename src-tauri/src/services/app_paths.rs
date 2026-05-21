use crate::domain::app_error::AppError;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Io(format!("failed to resolve app data dir: {e}")))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn model_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let mut dir = app_data_dir(app)?;
    dir.push("models");
    dir.push("whisper");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn settings_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let mut dir = app
        .path()
        .home_dir()
        .map_err(|e| AppError::Io(format!("failed to resolve home dir: {e}")))?;
    dir.push(".config");
    dir.push("murmur");
    std::fs::create_dir_all(&dir)?;
    dir.push("settings.yaml");
    Ok(dir)
}

pub fn legacy_settings_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let mut dir = app_data_dir(app)?;
    dir.push("settings.json");
    Ok(dir)
}
