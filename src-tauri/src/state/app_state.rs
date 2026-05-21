use crate::domain::model_manifest::ModelInfo;
use crate::services::model_manager::ModelManager;
use crate::services::whisper_service::WhisperService;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use tokio::sync::Mutex;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub default_model_id: String,
    pub language: String,
    pub translate: bool,
    pub auto_copy: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_model_id: "small".to_string(),
            language: "auto".to_string(),
            translate: false,
            auto_copy: false,
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
    pub whisper_service: WhisperService,
    pub download_flags: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            model_manager: ModelManager::new(),
            whisper_service: WhisperService::new(),
            download_flags: Mutex::new(HashMap::new()),
        }
    }

    pub fn manifest(&self) -> Vec<ModelInfo> {
        self.model_manager.list_models()
    }
}
