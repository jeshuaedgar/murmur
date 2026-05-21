mod commands;
mod domain;
mod services;
mod state;

use state::app_state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
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
