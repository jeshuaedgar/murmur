use crate::state::app_state::AppState;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_clipboard_manager::ClipboardExt;

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
pub async fn hide_overlay(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if *state.overlay_enabled.lock().await {
        return Ok(());
    }
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

#[tauri::command]
pub async fn set_overlay_enabled(
    app: AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<(), String> {
    {
        let mut overlay_enabled = state.overlay_enabled.lock().await;
        *overlay_enabled = enabled;
    }
    if let Some(window) = app.get_webview_window(OVERLAY_WINDOW_LABEL) {
        if enabled {
            window.unminimize().map_err(|err| err.to_string())?;
            window.show().map_err(|err| err.to_string())?;
        } else {
            window.hide().map_err(|err| err.to_string())?;
        }
        let _ = app.emit("overlay-enabled-changed", enabled);
        Ok(())
    } else {
        Err("overlay window is unavailable".to_string())
    }
}

#[tauri::command]
pub fn paste_text(app: AppHandle, text: String) -> Result<(), String> {
    if text.trim().is_empty() {
        return Ok(());
    }

    app.clipboard()
        .write_text(text)
        .map_err(|err| err.to_string())?;

    #[cfg(target_os = "macos")]
    {
        let status = std::process::Command::new("osascript")
            .args([
                "-e",
                "tell application \"System Events\" to keystroke \"v\" using command down",
            ])
            .status()
            .map_err(|err| err.to_string())?;
        if !status.success() {
            return Err("failed to trigger paste keystroke".to_string());
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        return Err("auto-paste keystroke is currently available on macOS only".to_string());
    }

    Ok(())
}
