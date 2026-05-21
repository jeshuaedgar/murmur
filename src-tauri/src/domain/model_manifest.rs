use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub url: String,
    pub file_name: String,
    pub recommended: bool,
    pub size_bytes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledModel {
    pub id: String,
    pub installed: bool,
    pub path: Option<String>,
    pub size_bytes: Option<u64>,
}

pub fn built_in_manifest() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "base".to_string(),
            name: "Base".to_string(),
            description: "Fast, lower accuracy, lightweight footprint".to_string(),
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
                .to_string(),
            file_name: "ggml-base.bin".to_string(),
            recommended: false,
            size_bytes: None,
        },
        ModelInfo {
            id: "small".to_string(),
            name: "Small".to_string(),
            description: "Balanced default for most local workflows".to_string(),
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
                .to_string(),
            file_name: "ggml-small.bin".to_string(),
            recommended: true,
            size_bytes: None,
        },
        ModelInfo {
            id: "medium".to_string(),
            name: "Medium".to_string(),
            description: "Higher accuracy with slower transcription speed".to_string(),
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin"
                .to_string(),
            file_name: "ggml-medium.bin".to_string(),
            recommended: false,
            size_bytes: None,
        },
        ModelInfo {
            id: "large-v3".to_string(),
            name: "Large v3".to_string(),
            description: "Best accuracy, highest compute requirements".to_string(),
            url: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin"
                .to_string(),
            file_name: "ggml-large-v3.bin".to_string(),
            recommended: false,
            size_bytes: None,
        },
    ]
}
