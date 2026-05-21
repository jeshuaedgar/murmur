use crate::domain::app_error::AppError;
use crate::domain::model_manifest::{InstalledModel, ModelInfo, built_in_manifest};
use crate::services::app_paths;
use tauri::AppHandle;

#[derive(Clone)]
pub struct ModelManager {
    manifest: Vec<ModelInfo>,
}

impl ModelManager {
    pub fn new() -> Self {
        Self {
            manifest: built_in_manifest(),
        }
    }

    pub fn list_models(&self) -> Vec<ModelInfo> {
        self.manifest.clone()
    }

    pub fn get_model(&self, model_id: &str) -> Result<ModelInfo, AppError> {
        self.manifest
            .iter()
            .find(|m| m.id == model_id)
            .cloned()
            .ok_or_else(|| AppError::NotFound(format!("unknown model: {model_id}")))
    }

    pub fn model_path(&self, app: &AppHandle, model_id: &str) -> Result<std::path::PathBuf, AppError> {
        let model = self.get_model(model_id)?;
        let mut dir = app_paths::model_dir(app)?;
        dir.push(model.file_name);
        Ok(dir)
    }

    pub fn installed_models(&self, app: &AppHandle) -> Result<Vec<InstalledModel>, AppError> {
        let mut output = Vec::new();
        for model in &self.manifest {
            let path = self.model_path(app, &model.id)?;
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

    pub fn delete_model(&self, app: &AppHandle, model_id: &str) -> Result<(), AppError> {
        let path = self.model_path(app, model_id)?;
        if path.exists() {
            std::fs::remove_file(path)?;
        }
        Ok(())
    }
}
