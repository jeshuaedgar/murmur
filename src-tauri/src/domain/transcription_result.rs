use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionOptions {
    pub model_id: String,
    pub language: Option<String>,
    pub translate: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionSegment {
    pub start_sec: f32,
    pub end_sec: f32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionResult {
    pub text: String,
    pub language: Option<String>,
    pub duration_ms: u128,
    pub segments: Vec<TranscriptionSegment>,
}
