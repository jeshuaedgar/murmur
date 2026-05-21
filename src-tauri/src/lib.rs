mod commands;
mod domain;
mod services;
mod state;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use state::app_state::AppState;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconEvent},
    AppHandle, Manager, WebviewWindow,
};

const MAIN_WINDOW_LABEL: &str = "main";
const MENU_ID_TOGGLE_WINDOW: &str = "toggle_window";
const MENU_ID_QUIT_APP: &str = "quit_app";

fn toggle_main_window(window: &WebviewWindow) {
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn with_main_window<F>(app: &AppHandle, f: F)
where
    F: FnOnce(&WebviewWindow),
{
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
        f(&window);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let quit_requested = Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .setup({
            let quit_requested = Arc::clone(&quit_requested);
            move |app| {
                let toggle_item =
                    MenuItemBuilder::with_id(MENU_ID_TOGGLE_WINDOW, "Show/Hide").build(app)?;
                let quit_item = MenuItemBuilder::with_id(MENU_ID_QUIT_APP, "Quit").build(app)?;
                let tray_menu = MenuBuilder::new(app)
                    .items(&[&toggle_item, &quit_item])
                    .build()?;

                tauri::tray::TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&tray_menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event({
                        let quit_requested = Arc::clone(&quit_requested);
                        move |app, event| match event.id().as_ref() {
                            MENU_ID_TOGGLE_WINDOW => {
                                with_main_window(app, toggle_main_window);
                            }
                            MENU_ID_QUIT_APP => {
                                quit_requested.store(true, Ordering::SeqCst);
                                app.exit(0);
                            }
                            _ => {}
                        }
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            with_main_window(&app, toggle_main_window);
                        }
                    })
                    .build(app)?;

                with_main_window(app.handle(), {
                    let quit_requested = Arc::clone(&quit_requested);
                    move |window| {
                        window.on_window_event({
                            let quit_requested = Arc::clone(&quit_requested);
                            move |event| {
                                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                                    if !quit_requested.load(Ordering::SeqCst) {
                                        api.prevent_close();
                                        let _ = window.hide();
                                    }
                                }
                            }
                        });
                    }
                });

                Ok(())
            }
        })
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::models::list_models,
            commands::models::get_installed_models,
            commands::models::download_model,
            commands::models::cancel_download,
            commands::models::delete_model,
            commands::models::check_huggingface_connectivity,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::get_app_data_dir,
            commands::transcription::transcribe_file,
            commands::transcription::transcribe_recording,
            commands::transcription::transcribe_pcm,
            commands::transcription::start_transcription_file,
            commands::transcription::cancel_transcription,
            commands::audio::get_audio_inputs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
