use crate::domain::app_error::AppError;
use crate::domain::model_manifest::{InstalledModel, ModelInfo};
use crate::services::app_paths;
use serde::Deserialize;
use tauri::AppHandle;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct ModelManager {
    manifest: std::sync::Arc<RwLock<Vec<ModelInfo>>>,
}

impl ModelManager {
    pub fn new() -> Self {
        Self {
            manifest: std::sync::Arc::new(RwLock::new(Vec::new())),
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
        let fetched = match fetch_models_from_huggingface().await {
            Ok(models) => {
                let _ = write_catalog_cache(app, &models);
                models
            }
            Err(network_error) => {
                read_catalog_cache(app).map_err(|_| network_error)?
            }
        };
        let mut manifest = self.manifest.write().await;
        *manifest = fetched.clone();
        Ok(fetched)
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
        size_bytes: None,
    },
    StaticModelSource {
        id: "cleanup-models:flan-t5-base",
        lab: "Cleanup Models",
        name: "FLAN-T5 Base (Cleanup)",
        description: "Stronger optional cleanup model for higher-end hardware. Uses a different backend path than Whisper transcription.",
        url: "https://huggingface.co/google/flan-t5-base/resolve/main/model.safetensors",
        file_name: "cleanup-flan-t5-base-model.safetensors",
        size_bytes: None,
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

            let stable_id = if source.lab == "OpenAI Whisper" { id.clone() } else { format!("{}:{}", source.lab.to_lowercase().replace(' ', "-"), id) };

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
        .filter_map(|(idx, model)| model.size_bytes.map(|size| (idx, ((size as f64).ln() - target).abs())))
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

fn write_catalog_cache(app: &AppHandle, models: &[ModelInfo]) -> Result<(), AppError> {
    let path = app_paths::model_catalog_cache_path(app)?;
    let json = serde_json::to_string_pretty(models)?;
    std::fs::write(path, json)?;
    Ok(())
}

fn read_catalog_cache(app: &AppHandle) -> Result<Vec<ModelInfo>, AppError> {
    let path = app_paths::model_catalog_cache_path(app)?;
    if !path.exists() {
        return Err(AppError::NotFound(
            "no cached model catalog available".to_string(),
        ));
    }
    let json = std::fs::read_to_string(path)?;
    let models: Vec<ModelInfo> = serde_json::from_str(&json)?;
    if models.is_empty() {
        return Err(AppError::NotFound(
            "cached model catalog is empty".to_string(),
        ));
    }
    Ok(models)
}
