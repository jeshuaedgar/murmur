use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionRecord {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    pub source_type: String,
    pub model_id: String,
    pub language: Option<String>,
    pub translated: bool,
    pub raw_text: String,
    pub cleaned_text: String,
    pub cleanup_strategy: String,
    pub duration_ms: Option<i64>,
    pub audio_path: Option<String>,
    pub pinned: bool,
    pub deleted_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveTranscriptionInput {
    pub id: Option<String>,
    pub created_at: Option<String>,
    pub source_type: String,
    pub model_id: String,
    pub language: Option<String>,
    #[serde(default)]
    pub translated: bool,
    pub raw_text: String,
    pub cleaned_text: String,
    pub cleanup_strategy: String,
    pub duration_ms: Option<i64>,
    pub audio_path: Option<String>,
    #[serde(default)]
    pub pinned: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListTranscriptionsInput {
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    #[serde(default)]
    pub include_deleted: bool,
    #[serde(default)]
    pub pinned_only: bool,
    pub query: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTranscriptionInput {
    pub model_id: Option<String>,
    pub language: Option<String>,
    pub translated: Option<bool>,
    pub raw_text: Option<String>,
    pub cleaned_text: Option<String>,
    pub cleanup_strategy: Option<String>,
    pub duration_ms: Option<i64>,
    pub audio_path: Option<String>,
    pub pinned: Option<bool>,
    pub source_type: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportTranscriptionsReport {
    pub imported: usize,
    pub skipped: usize,
    pub failed: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionHistoryStats {
    pub total_count: i64,
    pub pinned_count: i64,
    pub deleted_count: i64,
    pub avg_duration_ms: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportBundleZipResult {
    pub bytes: Vec<u8>,
    pub total_entries: usize,
    pub audio_referenced: usize,
    pub audio_included: usize,
    pub audio_missing: usize,
}
