mod commands;
mod domain;
mod services;
mod state;

use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use state::app_state::{AppSettings, AppState};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconEvent},
    AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tauri_plugin_sql::{Migration, MigrationKind};

const MAIN_WINDOW_LABEL: &str = "main";
const OVERLAY_WINDOW_LABEL: &str = "overlay";
const MENU_ID_TOGGLE_WINDOW: &str = "toggle_window";
const MENU_ID_TOGGLE_OVERLAY: &str = "toggle_overlay";
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

fn toggle_overlay_window(window: &WebviewWindow) {
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn with_overlay_window<F>(app: &AppHandle, f: F)
where
    F: FnOnce(&WebviewWindow),
{
    if let Some(window) = app.get_webview_window(OVERLAY_WINDOW_LABEL) {
        f(&window);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let quit_requested = Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(
                    "sqlite:murmur.db",
                    vec![Migration {
                        version: 1,
                        description: "create_transcriptions_table",
                        sql: "
                            CREATE TABLE IF NOT EXISTS transcriptions (
                                id TEXT PRIMARY KEY,
                                created_at TEXT NOT NULL,
                                updated_at TEXT NOT NULL,
                                source_type TEXT NOT NULL,
                                model_id TEXT NOT NULL,
                                language TEXT NULL,
                                translated INTEGER NOT NULL DEFAULT 0,
                                raw_text TEXT NOT NULL,
                                cleaned_text TEXT NOT NULL,
                                cleanup_strategy TEXT NOT NULL,
                                duration_ms INTEGER NULL,
                                audio_path TEXT NULL,
                                pinned INTEGER NOT NULL DEFAULT 0,
                                deleted_at TEXT NULL
                            );

                            CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions(created_at DESC);
                            CREATE INDEX IF NOT EXISTS idx_transcriptions_pinned_created ON transcriptions(pinned DESC, created_at DESC);
                            CREATE INDEX IF NOT EXISTS idx_transcriptions_search ON transcriptions(cleaned_text, raw_text);
                        ",
                        kind: MigrationKind::Up,
                    }],
                )
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new().with_handler(|app, _shortcut, _event| {
                with_overlay_window(app, toggle_overlay_window);
            }).build(),
        )
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None::<Vec<&str>>,
        ))
        .setup({
            let quit_requested = Arc::clone(&quit_requested);
            move |app| {
                let toggle_item =
                    MenuItemBuilder::with_id(MENU_ID_TOGGLE_WINDOW, "Show/Hide").build(app)?;
                let toggle_overlay_item =
                    MenuItemBuilder::with_id(MENU_ID_TOGGLE_OVERLAY, "Toggle Overlay").build(app)?;
                let quit_item = MenuItemBuilder::with_id(MENU_ID_QUIT_APP, "Quit").build(app)?;
                let tray_menu = MenuBuilder::new(app)
                    .items(&[&toggle_item, &toggle_overlay_item, &quit_item])
                    .build()?;

                let startup_settings = commands::settings::get_settings(app.handle().clone())
                    .unwrap_or_else(|_| AppSettings::default());
                let overlay_url = WebviewUrl::App("/overlay".into());
                WebviewWindowBuilder::new(app, OVERLAY_WINDOW_LABEL, overlay_url)
                    .title("Murmur Overlay")
                    .inner_size(420.0, 180.0)
                    .decorations(false)
                    .always_on_top(startup_settings.overlay_pinned)
                    .resizable(false)
                    .skip_taskbar(true)
                    .visible(false)
                    .build()?;

                if let Err(error) = app
                    .global_shortcut()
                    .register(startup_settings.overlay_shortcut.as_str())
                {
                    eprintln!("global shortcut registration warning: {error}");
                }

                #[cfg(target_os = "macos")]
                let tray_icon = if let Ok(decoded) =
                    image::load_from_memory(include_bytes!("../icons/tray-macos-template.png"))
                {
                    let rgba = decoded.to_rgba8();
                    let (width, height) = rgba.dimensions();
                    Image::new_owned(rgba.into_raw(), width, height)
                } else {
                    app.default_window_icon().expect("default window icon must exist").clone().into()
                };

                #[cfg(not(target_os = "macos"))]
                let tray_icon = app
                    .default_window_icon()
                    .expect("default window icon must exist")
                    .clone()
                    .into();

                tauri::tray::TrayIconBuilder::new()
                    .icon(tray_icon)
                    .icon_as_template(cfg!(target_os = "macos"))
                    .menu(&tray_menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event({
                        let quit_requested = Arc::clone(&quit_requested);
                        move |app, event| match event.id().as_ref() {
                            MENU_ID_TOGGLE_WINDOW => {
                                with_main_window(app, toggle_main_window);
                            }
                            MENU_ID_TOGGLE_OVERLAY => {
                                with_overlay_window(app, toggle_overlay_window);
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
                        let window = window.clone();
                        let window_for_close = window.clone();
                        window.on_window_event({
                            let quit_requested = Arc::clone(&quit_requested);
                            move |event| {
                                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                                    if !quit_requested.load(Ordering::SeqCst) {
                                        api.prevent_close();
                                        let _ = window_for_close.hide();
                                    }
                                }
                            }
                        });
                    }
                });

                with_overlay_window(app.handle(), move |window| {
                    let window = window.clone();
                    let window_for_close = window.clone();
                    window.on_window_event(move |event| {
                        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                            let _ = window_for_close.hide();
                        }
                    });
                });

                if let Err(error) = commands::settings::validate_settings_on_startup(app.handle()) {
                    eprintln!("settings validation warning: {error}");
                }

                let state = app.state::<AppState>();
                {
                    let mut overlay_shortcut = tauri::async_runtime::block_on(state.overlay_shortcut.lock());
                    *overlay_shortcut = startup_settings.overlay_shortcut;
                }
                if let Err(error) = state.transcription_store.initialize(app.handle()) {
                    eprintln!("transcription store initialization warning: {error}");
                }

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
            commands::models::invalidate_model_catalog_cache,
            commands::models::get_model_catalog_cache_diagnostics,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::get_app_data_dir,
            commands::settings::get_settings_file_path,
            commands::settings::is_start_at_login_enabled,
            commands::settings::set_start_at_login,
            commands::overlay::toggle_overlay,
            commands::overlay::show_overlay,
            commands::overlay::hide_overlay,
            commands::overlay::set_overlay_shortcut,
            commands::overlay::set_overlay_pinned,
            commands::transcription::transcribe_file,
            commands::transcription::transcribe_recording,
            commands::transcription::transcribe_pcm,
            commands::transcription::cleanup_text,
            commands::transcription::start_transcription_file,
            commands::transcription::cancel_transcription,
            commands::audio::get_audio_inputs,
            commands::history::save_transcription,
            commands::history::list_transcriptions,
            commands::history::get_transcription,
            commands::history::update_transcription,
            commands::history::delete_transcription,
            commands::history::restore_transcription,
            commands::history::export_transcriptions,
            commands::history::import_transcriptions,
            commands::history::export_transcriptions_csv,
            commands::history::export_transcriptions_bundle_zip,
            commands::history::get_transcription_history_stats,
            commands::history::apply_history_retention,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
