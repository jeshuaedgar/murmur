use crate::domain::app_error::AppError;
use futures_util::StreamExt;
use reqwest::Client;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressEvent {
    pub task_id: String,
    pub model_id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub progress_pct: Option<f32>,
}

pub async fn download_to_file(
    app: AppHandle,
    task_id: String,
    model_id: String,
    url: String,
    final_path: PathBuf,
    cancel_flag: Arc<AtomicBool>,
) -> Result<(), AppError> {
    let allowed = [
        "https://huggingface.co/ggerganov/whisper.cpp/",
        "https://huggingface.co/distil-whisper/distil-large-v3-ggml/",
        "https://huggingface.co/distil-whisper/distil-large-v3.5-ggml/",
        "https://huggingface.co/distil-whisper/distil-small.en/",
    ];
    if !allowed.iter().any(|prefix| url.starts_with(prefix)) {
        return Err(AppError::InvalidInput("model URL is not allowlisted".to_string()));
    }

    let temp_path = temp_path_for(&final_path)?;
    let client = Client::new();
    let response = client.get(url).send().await?.error_for_status()?;
    let total_bytes = response.content_length();
    let mut stream = response.bytes_stream();

    if let Some(parent) = temp_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let mut file = tokio::fs::File::create(&temp_path).await?;
    let mut downloaded: u64 = 0;

    while let Some(chunk) = stream.next().await {
        if cancel_flag.load(Ordering::Relaxed) {
            let _ = tokio::fs::remove_file(&temp_path).await;
            return Err(AppError::Conflict("download canceled".to_string()));
        }

        let chunk = chunk?;
        file.write_all(&chunk).await?;
        downloaded += chunk.len() as u64;
        let progress_pct = total_bytes.map(|t| (downloaded as f32 / t as f32) * 100.0);

        let payload = DownloadProgressEvent {
            task_id: task_id.clone(),
            model_id: model_id.clone(),
            downloaded_bytes: downloaded,
            total_bytes,
            progress_pct,
        };
        let _ = app.emit("model-download-progress", payload);
    }

    file.flush().await?;
    tokio::fs::rename(&temp_path, &final_path).await?;

    Ok(())
}

fn temp_path_for(path: &Path) -> Result<PathBuf, AppError> {
    let file_name = path
        .file_name()
        .and_then(|v| v.to_str())
        .ok_or_else(|| AppError::InvalidInput("invalid target model path".to_string()))?;
    Ok(path.with_file_name(format!("{}.part", file_name)))
}
