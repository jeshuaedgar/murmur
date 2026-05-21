use crate::services::model_manager::ModelManager;
use crate::services::cleanup_service::CleanupService;
use crate::services::whisper_service::WhisperService;
use crate::services::transcription_store::TranscriptionStore;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use tokio::sync::Mutex;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct AppSettings {
    pub default_model_id: String,
    pub language: String,
    pub translate: bool,
    pub auto_copy: bool,
    pub start_at_login: bool,
    pub live_mode: bool,
    pub audio_input_device_id: Option<String>,
    pub cleanup_enabled: bool,
    pub live_cleanup_enabled: bool,
    pub live_cleanup_mode: String,
    pub finalize_cleanup_mode: String,
    pub cleanup_latency_budget_ms: u32,
    pub cleanup_show_raw_toggle: bool,
    pub cleanup_backend: String,
    pub cleanup_model_id: Option<String>,
    pub history_retention_days: Option<u32>,
    pub history_retention_include_pinned: bool,
    pub overlay_shortcut: String,
    pub overlay_pinned: bool,
    pub overlay_hide_stops_recording: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_model_id: "small".to_string(),
            language: "auto".to_string(),
            translate: false,
            auto_copy: false,
            start_at_login: false,
            live_mode: true,
            audio_input_device_id: None,
            cleanup_enabled: true,
            live_cleanup_enabled: true,
            live_cleanup_mode: "rules".to_string(),
            finalize_cleanup_mode: "rules".to_string(),
            cleanup_latency_budget_ms: 200,
            cleanup_show_raw_toggle: false,
            cleanup_backend: "rules_only".to_string(),
            cleanup_model_id: None,
            history_retention_days: None,
            history_retention_include_pinned: false,
            overlay_shortcut: "CmdOrCtrl+Shift+Space".to_string(),
            overlay_pinned: true,
            overlay_hide_stops_recording: true,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTaskInfo {
    pub task_id: String,
    pub model_id: String,
    pub status: String,
}

pub struct AppState {
    pub model_manager: ModelManager,
    pub transcription_store: TranscriptionStore,
    pub whisper_service: Arc<WhisperService>,
    pub cleanup_service: Arc<CleanupService>,
    pub download_flags: Mutex<HashMap<String, Arc<AtomicBool>>>,
    pub transcription_flags: Mutex<HashMap<String, Arc<AtomicBool>>>,
    pub overlay_shortcut: Mutex<String>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            model_manager: ModelManager::new(),
            transcription_store: TranscriptionStore::new(),
            whisper_service: Arc::new(WhisperService::new()),
            cleanup_service: Arc::new(CleanupService::new()),
            download_flags: Mutex::new(HashMap::new()),
            transcription_flags: Mutex::new(HashMap::new()),
            overlay_shortcut: Mutex::new(AppSettings::default().overlay_shortcut),
        }
    }
}
