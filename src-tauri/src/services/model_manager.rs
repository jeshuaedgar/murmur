use crate::domain::app_error::AppError;
use crate::domain::model_manifest::{InstalledModel, ModelInfo};
use crate::services::app_paths;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use tokio::sync::RwLock;

const MODEL_CATALOG_CACHE_KEY: &str = "hf:model_catalog:v1";
const MODEL_CATALOG_CACHE_SCHEMA_VERSION: u32 = 2;
const MODEL_CATALOG_CACHE_TTL_MS: i64 = 6 * 60 * 60 * 1000;
const MODEL_CATALOG_CACHE_STORE_PATH: &str = "cache.store";

#[derive(Clone)]
pub struct ModelManager {
    manifest: std::sync::Arc<RwLock<Vec<ModelInfo>>>,
    diagnostics: std::sync::Arc<RwLock<ModelCatalogCacheDiagnostics>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelCatalogCacheDiagnostics {
    pub status: String,
    pub key: String,
    pub schema_version: u32,
    pub ttl_ms: i64,
    pub fetched_at: Option<i64>,
    pub age_ms: Option<i64>,
}

impl ModelManager {
    pub fn new() -> Self {
        Self {
            manifest: std::sync::Arc::new(RwLock::new(Vec::new())),
            diagnostics: std::sync::Arc::new(RwLock::new(ModelCatalogCacheDiagnostics {
                status: "unknown".to_string(),
                key: MODEL_CATALOG_CACHE_KEY.to_string(),
                schema_version: MODEL_CATALOG_CACHE_SCHEMA_VERSION,
                ttl_ms: MODEL_CATALOG_CACHE_TTL_MS,
                fetched_at: None,
                age_ms: None,
            })),
        }
    }

    pub async fn list_models(&self, app: &AppHandle) -> Result<Vec<ModelInfo>, AppError> {
        self.ensure_manifest(app).await
    }

    pub async fn get_model(&self, app: &AppHandle, model_id: &str) -> Result<ModelInfo, AppError> {
        self.ensure_manifest(app)
            .await?
            .iter()
            .find(|m| m.id == model_id)
            .cloned()
            .ok_or_else(|| AppError::NotFound(format!("unknown model: {model_id}")))
    }

    pub async fn model_path(
        &self,
        app: &AppHandle,
        model_id: &str,
    ) -> Result<std::path::PathBuf, AppError> {
        let model = self.get_model(app, model_id).await?;
        let mut dir = app_paths::model_dir(app)?;
        dir.push(model.file_name);
        Ok(dir)
    }

    pub async fn installed_models(&self, app: &AppHandle) -> Result<Vec<InstalledModel>, AppError> {
        let models = self.ensure_manifest(app).await?;
        let mut output = Vec::new();
        for model in &models {
            let path = self.model_path(app, &model.id).await?;
            if path.exists() {
                let metadata = std::fs::metadata(&path)?;
                output.push(InstalledModel {
                    id: model.id.clone(),
                    installed: true,
                    path: Some(path.to_string_lossy().to_string()),
                    size_bytes: Some(metadata.len()),
                });
            } else {
                output.push(InstalledModel {
                    id: model.id.clone(),
                    installed: false,
                    path: None,
                    size_bytes: None,
                });
            }
        }
        Ok(output)
    }

    pub async fn delete_model(&self, app: &AppHandle, model_id: &str) -> Result<(), AppError> {
        let path = self.model_path(app, model_id).await?;
        if path.exists() {
            std::fs::remove_file(path)?;
        }
        Ok(())
    }

    pub async fn check_huggingface_connectivity(&self) -> Result<(), AppError> {
        const HF_PING_URL: &str = "https://huggingface.co/";
        reqwest::Client::new()
            .head(HF_PING_URL)
            .timeout(std::time::Duration::from_secs(4))
            .send()
            .await?
            .error_for_status()?;
        Ok(())
    }

    pub async fn invalidate_catalog_cache(&self, app: &AppHandle) -> Result<(), AppError> {
        let store = app
            .store(MODEL_CATALOG_CACHE_STORE_PATH)
            .map_err(|e| AppError::Io(format!("failed to open cache store: {e}")))?;
        store.delete(MODEL_CATALOG_CACHE_KEY);
        store
            .save()
            .map_err(|e| AppError::Io(format!("failed to save cache store: {e}")))?;

        let mut manifest = self.manifest.write().await;
        manifest.clear();
        self.set_diagnostics("invalidated", None).await;
        Ok(())
    }

    pub async fn cache_diagnostics(&self) -> ModelCatalogCacheDiagnostics {
        self.diagnostics.read().await.clone()
    }

    async fn ensure_manifest(&self, app: &AppHandle) -> Result<Vec<ModelInfo>, AppError> {
        {
            let manifest = self.manifest.read().await;
            if !manifest.is_empty() {
                return Ok(manifest.clone());
            }
        }
        self.refresh_manifest(app).await
    }

    async fn refresh_manifest(&self, app: &AppHandle) -> Result<Vec<ModelInfo>, AppError> {
        let cache = read_catalog_cache(app).ok().flatten();

        if let Some(cached) = cache.as_ref().filter(|c| c.is_fresh()) {
            eprintln!("model catalog cache status=fresh");
            self.set_diagnostics("fresh", Some(cached)).await;
            let mut manifest = self.manifest.write().await;
            *manifest = cached.payload.clone();
            return Ok(cached.payload.clone());
        }

        match fetch_models_from_huggingface().await {
            Ok(models) => {
                let _ = write_catalog_cache(app, CatalogCacheEntry::new(models.clone()));
                eprintln!("model catalog cache status=miss");
                self.set_diagnostics("miss", None).await;
                let mut manifest = self.manifest.write().await;
                *manifest = models.clone();
                Ok(models)
            }
            Err(network_error) => {
                if should_use_stale_cache(cache.as_ref(), true) {
                    let Some(stale) = cache else {
                        return Err(network_error);
                    };
                    eprintln!("model catalog cache status=stale-fallback");
                    self.set_diagnostics("stale", Some(&stale)).await;
                    let mut manifest = self.manifest.write().await;
                    *manifest = stale.payload.clone();
                    return Ok(stale.payload);
                }
                self.set_diagnostics("network-error", None).await;
                Err(network_error)
            }
        }
    }

    async fn set_diagnostics(&self, status: &str, cache: Option<&CatalogCacheEntry>) {
        let now = now_ms();
        let mut diagnostics = self.diagnostics.write().await;
        diagnostics.status = status.to_string();
        diagnostics.fetched_at = cache.map(|entry| entry.fetched_at);
        diagnostics.age_ms = cache.map(|entry| now - entry.fetched_at);
    }
}

#[derive(Debug, Deserialize)]
struct HfModelFile {
    rfilename: String,
    size: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct HfModelResponse {
    description: Option<String>,
    siblings: Vec<HfModelFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CatalogCacheEntry {
    payload: Vec<ModelInfo>,
    fetched_at: i64,
    ttl_ms: i64,
    etag: Option<String>,
    schema_version: u32,
}

impl CatalogCacheEntry {
    fn new(payload: Vec<ModelInfo>) -> Self {
        Self {
            payload,
            fetched_at: now_ms(),
            ttl_ms: MODEL_CATALOG_CACHE_TTL_MS,
            etag: None,
            schema_version: MODEL_CATALOG_CACHE_SCHEMA_VERSION,
        }
    }

    fn is_fresh(&self) -> bool {
        self.schema_version == MODEL_CATALOG_CACHE_SCHEMA_VERSION
            && !self.payload.is_empty()
            && now_ms() - self.fetched_at <= self.ttl_ms
    }
}

fn should_use_stale_cache(cache: Option<&CatalogCacheEntry>, network_failed: bool) -> bool {
    network_failed && cache.is_some_and(|entry| !entry.payload.is_empty())
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

#[derive(Clone, Copy)]
struct CatalogSource {
    lab: &'static str,
    api_url: &'static str,
    resolve_base: &'static str,
    id_hint: Option<&'static str>,
}

struct StaticModelSource {
    id: &'static str,
    lab: &'static str,
    name: &'static str,
    description: &'static str,
    url: &'static str,
    file_name: &'static str,
    size_bytes: Option<u64>,
}

const CATALOG_SOURCES: [CatalogSource; 4] = [
    CatalogSource {
        lab: "OpenAI Whisper",
        api_url: "https://huggingface.co/api/models/ggerganov/whisper.cpp?blobs=true",
        resolve_base: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/",
        id_hint: None,
    },
    CatalogSource {
        lab: "Distil-Whisper",
        api_url: "https://huggingface.co/api/models/distil-whisper/distil-large-v3-ggml?blobs=true",
        resolve_base: "https://huggingface.co/distil-whisper/distil-large-v3-ggml/resolve/main/",
        id_hint: Some("distil-large-v3"),
    },
    CatalogSource {
        lab: "Distil-Whisper",
        api_url: "https://huggingface.co/api/models/distil-whisper/distil-large-v3.5-ggml?blobs=true",
        resolve_base: "https://huggingface.co/distil-whisper/distil-large-v3.5-ggml/resolve/main/",
        id_hint: Some("distil-large-v3.5"),
    },
    CatalogSource {
        lab: "Distil-Whisper",
        api_url: "https://huggingface.co/api/models/distil-whisper/distil-small.en?blobs=true",
        resolve_base: "https://huggingface.co/distil-whisper/distil-small.en/resolve/main/",
        id_hint: Some("distil-small.en"),
    },
];

const STATIC_MODEL_SOURCES: [StaticModelSource; 2] = [
    StaticModelSource {
        id: "cleanup-models:flan-t5-small",
        lab: "Cleanup Models",
        name: "FLAN-T5 Small (Cleanup)",
        description: "Optional local cleanup model backend for transcript rewrite. Uses a different backend path than Whisper transcription.",
        url: "https://huggingface.co/google/flan-t5-small/resolve/main/model.safetensors",
        file_name: "cleanup-flan-t5-small-model.safetensors",
        size_bytes: Some(307_867_048),
    },
    StaticModelSource {
        id: "cleanup-models:flan-t5-base",
        lab: "Cleanup Models",
        name: "FLAN-T5 Base (Cleanup)",
        description: "Stronger optional cleanup model for higher-end hardware. Uses a different backend path than Whisper transcription.",
        url: "https://huggingface.co/google/flan-t5-base/resolve/main/model.safetensors",
        file_name: "cleanup-flan-t5-base-model.safetensors",
        size_bytes: Some(990_345_061),
    },
];

async fn fetch_models_from_huggingface() -> Result<Vec<ModelInfo>, AppError> {
    let client = reqwest::Client::new();
    let mut models = Vec::new();

    for source in CATALOG_SOURCES {
        let response = match client.get(source.api_url).send().await {
            Ok(resp) => match resp.error_for_status() {
                Ok(ok) => match ok.json::<HfModelResponse>().await {
                    Ok(parsed) => parsed,
                    Err(_) => continue,
                },
                Err(_) => continue,
            },
            Err(_) => continue,
        };

        let repo_description = response
            .description
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(ToString::to_string);

        for file in response
            .siblings
            .into_iter()
            .filter(|file| is_compatible_ggml_model(source.lab, &file.rfilename))
        {
            let raw_id = file
                .rfilename
                .trim_start_matches("ggml-")
                .trim_end_matches(".bin")
                .to_string();
            let id = if raw_id == "model" {
                source.id_hint.unwrap_or("model").to_string()
            } else {
                raw_id
            };
            let name = id
                .split('-')
                .map(|part| {
                    let mut chars = part.chars();
                    match chars.next() {
                        Some(first) => {
                            format!("{}{}", first.to_ascii_uppercase(), chars.as_str())
                        }
                        None => String::new(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" ");
            let description = repo_description
                .clone()
                .unwrap_or_else(|| describe_model(file.size));

            let stable_id = if source.lab == "OpenAI Whisper" {
                id.clone()
            } else {
                format!("{}:{}", source.lab.to_lowercase().replace(' ', "-"), id)
            };

            models.push(ModelInfo {
                id: stable_id,
                lab: source.lab.to_string(),
                name,
                description,
                url: format!("{}{}", source.resolve_base, file.rfilename),
                file_name: file.rfilename,
                recommended: false,
                fastest: false,
                best_quality: false,
                size_bytes: file.size,
            });
        }
    }

    for source in STATIC_MODEL_SOURCES {
        models.push(ModelInfo {
            id: source.id.to_string(),
            lab: source.lab.to_string(),
            name: source.name.to_string(),
            description: source.description.to_string(),
            url: source.url.to_string(),
            file_name: source.file_name.to_string(),
            recommended: false,
            fastest: false,
            best_quality: false,
            size_bytes: source.size_bytes,
        });
    }

    models.sort_by(|a, b| {
        lab_sort_key(&a.lab)
            .cmp(&lab_sort_key(&b.lab))
            .then_with(|| a.lab.cmp(&b.lab))
            .then_with(|| {
                a.size_bytes
                    .unwrap_or(u64::MAX)
                    .cmp(&b.size_bytes.unwrap_or(u64::MAX))
            })
            .then_with(|| a.id.cmp(&b.id))
    });

    if let Some(best) = pick_recommended_model_index(&models) {
        if let Some(item) = models.get_mut(best) {
            item.recommended = true;
        }
    }
    if let Some(fastest) = pick_fastest_model_index(&models) {
        if let Some(item) = models.get_mut(fastest) {
            item.fastest = true;
        }
    }
    if let Some(best_quality) = pick_best_quality_model_index(&models) {
        if let Some(item) = models.get_mut(best_quality) {
            item.best_quality = true;
        }
    }

    if models.is_empty() {
        return Err(AppError::NotFound(
            "no compatible GGML Whisper models found in remote catalog".to_string(),
        ));
    }

    Ok(models)
}

fn is_primary_ggml_model(file_name: &str) -> bool {
    file_name.starts_with("ggml-")
        && file_name.ends_with(".bin")
        && !file_name.contains(".en")
        && !file_name.contains("-q")
        && !file_name.contains("-distil")
        && !file_name.contains("-tdrz")
        && !file_name.contains("-encoder")
}

fn is_compatible_ggml_model(lab: &str, file_name: &str) -> bool {
    if lab == "Distil-Whisper" {
        return file_name.starts_with("ggml-")
            && file_name.ends_with(".bin")
            && !file_name.contains("-q")
            && !file_name.contains("-tdrz")
            && !file_name.contains("-encoder")
            && !file_name.contains(".fp32.");
    }
    is_primary_ggml_model(file_name)
}

fn describe_model(size_bytes: Option<u64>) -> String {
    let gib = size_bytes
        .map(|bytes| bytes as f64 / (1024.0 * 1024.0 * 1024.0))
        .unwrap_or(0.0);

    if gib < 0.25 {
        "Fastest downloads and lowest resource usage; lower transcription quality.".to_string()
    } else if gib < 1.0 {
        "Balanced speed and quality for everyday local transcription.".to_string()
    } else if gib < 2.2 {
        "Higher quality with slower runtime and larger memory footprint.".to_string()
    } else {
        "Best quality tier with highest compute and storage requirements.".to_string()
    }
}

fn pick_recommended_model_index(models: &[ModelInfo]) -> Option<usize> {
    if let Some((idx, _)) = models
        .iter()
        .enumerate()
        .find(|(_, model)| model.id.contains("turbo"))
    {
        return Some(idx);
    }

    let sizes = models.iter().filter_map(|m| m.size_bytes).collect::<Vec<_>>();
    if sizes.is_empty() {
        return None;
    }
    let min = *sizes.iter().min()?;
    let max = *sizes.iter().max()?;
    if min == max {
        return Some(0);
    }

    let min_ln = (min as f64).ln();
    let max_ln = (max as f64).ln();
    let target = min_ln + (max_ln - min_ln) * 0.55;

    models
        .iter()
        .enumerate()
        .filter_map(|(idx, model)| {
            model
                .size_bytes
                .map(|size| (idx, ((size as f64).ln() - target).abs()))
        })
        .min_by(|a, b| a.1.total_cmp(&b.1))
        .map(|(idx, _)| idx)
}

fn pick_fastest_model_index(models: &[ModelInfo]) -> Option<usize> {
    models
        .iter()
        .enumerate()
        .filter_map(|(idx, model)| model.size_bytes.map(|size| (idx, size)))
        .min_by_key(|(_, size)| *size)
        .map(|(idx, _)| idx)
}

fn pick_best_quality_model_index(models: &[ModelInfo]) -> Option<usize> {
    models
        .iter()
        .enumerate()
        .filter_map(|(idx, model)| model.size_bytes.map(|size| (idx, size)))
        .max_by_key(|(_, size)| *size)
        .map(|(idx, _)| idx)
}

fn lab_sort_key(lab: &str) -> u8 {
    match lab {
        "OpenAI Whisper" => 0,
        "Distil-Whisper" => 1,
        "Cleanup Models" => u8::MAX,
        _ => 200,
    }
}

fn write_catalog_cache(app: &AppHandle, cache: CatalogCacheEntry) -> Result<(), AppError> {
    let store = app
        .store(MODEL_CATALOG_CACHE_STORE_PATH)
        .map_err(|e| AppError::Io(format!("failed to open cache store: {e}")))?;

    store.set(
        MODEL_CATALOG_CACHE_KEY,
        serde_json::to_value(cache)
            .map_err(|e| AppError::InvalidInput(format!("invalid cache payload: {e}")))?,
    );
    store
        .save()
        .map_err(|e| AppError::Io(format!("failed to save cache store: {e}")))?;
    Ok(())
}

fn read_catalog_cache(app: &AppHandle) -> Result<Option<CatalogCacheEntry>, AppError> {
    let store = app
        .store(MODEL_CATALOG_CACHE_STORE_PATH)
        .map_err(|e| AppError::Io(format!("failed to open cache store: {e}")))?;

    let value = match store.get(MODEL_CATALOG_CACHE_KEY) {
        Some(value) => value,
        None => return Ok(None),
    };

    let cache: CatalogCacheEntry = serde_json::from_value(value)
        .map_err(|e| AppError::InvalidInput(format!("invalid cache entry: {e}")))?;

    if cache.schema_version != MODEL_CATALOG_CACHE_SCHEMA_VERSION || cache.payload.is_empty() {
        return Ok(None);
    }

    Ok(Some(cache))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_freshness_checks_expiry() {
        let fresh = CatalogCacheEntry {
            payload: vec![ModelInfo {
                id: "small".to_string(),
                lab: "OpenAI Whisper".to_string(),
                name: "Small".to_string(),
                description: "x".to_string(),
                url: "https://example.com".to_string(),
                file_name: "ggml-small.bin".to_string(),
                recommended: false,
                fastest: false,
                best_quality: false,
                size_bytes: Some(10),
            }],
            fetched_at: now_ms(),
            ttl_ms: 60_000,
            etag: None,
            schema_version: MODEL_CATALOG_CACHE_SCHEMA_VERSION,
        };

        assert!(fresh.is_fresh());

        let stale = CatalogCacheEntry {
            fetched_at: now_ms() - 120_000,
            ..fresh
        };
        assert!(!stale.is_fresh());
        assert!(should_use_stale_cache(Some(&stale), true));
        assert!(!should_use_stale_cache(Some(&stale), false));
    }
}
