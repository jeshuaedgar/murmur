use crate::state::app_state::AppState;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

const OVERLAY_WINDOW_LABEL: &str = "overlay";

fn toggle_overlay_window(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(OVERLAY_WINDOW_LABEL) {
        if window.is_visible().map_err(|err| err.to_string())? {
            window.hide().map_err(|err| err.to_string())?;
        } else {
            window.unminimize().map_err(|err| err.to_string())?;
            window.show().map_err(|err| err.to_string())?;
            window.set_focus().map_err(|err| err.to_string())?;
        }
        Ok(())
    } else {
        Err("overlay window is unavailable".to_string())
    }
}

#[tauri::command]
pub fn toggle_overlay(app: AppHandle) -> Result<(), String> {
    toggle_overlay_window(&app)
}

#[tauri::command]
pub fn show_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(OVERLAY_WINDOW_LABEL) {
        window.unminimize().map_err(|err| err.to_string())?;
        window.show().map_err(|err| err.to_string())?;
        window.set_focus().map_err(|err| err.to_string())?;
        Ok(())
    } else {
        Err("overlay window is unavailable".to_string())
    }
}

#[tauri::command]
pub fn hide_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(OVERLAY_WINDOW_LABEL) {
        window.hide().map_err(|err| err.to_string())
    } else {
        Err("overlay window is unavailable".to_string())
    }
}

#[tauri::command]
pub async fn set_overlay_shortcut(
    app: AppHandle,
    state: State<'_, AppState>,
    shortcut: String,
) -> Result<(), String> {
    let trimmed = shortcut.trim();
    if trimmed.is_empty() {
        return Err("shortcut cannot be empty".to_string());
    }

    let mut active_shortcut = state.overlay_shortcut.lock().await;
    if *active_shortcut == trimmed {
        return Ok(());
    }

    let previous = active_shortcut.clone();
    app.global_shortcut()
        .unregister(previous.as_str())
        .map_err(|err| err.to_string())?;

    if let Err(error) = app.global_shortcut().register(trimmed) {
        let _ = app.global_shortcut().register(previous.as_str());
        return Err(error.to_string());
    }

    *active_shortcut = trimmed.to_string();
    Ok(())
}

#[tauri::command]
pub fn set_overlay_pinned(app: AppHandle, pinned: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(OVERLAY_WINDOW_LABEL) {
        window
            .set_always_on_top(pinned)
            .map_err(|err| err.to_string())
    } else {
        Err("overlay window is unavailable".to_string())
    }
}
