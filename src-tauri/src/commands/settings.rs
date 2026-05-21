use crate::services::app_paths;
use crate::state::app_state::AppSettings;
use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

#[derive(Debug)]
struct ValidatedSettings {
    settings: AppSettings,
    invalid_keys: Vec<&'static str>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SettingsLoadSource {
    ExistingYaml,
    MigratedLegacyJson,
    DefaultedMissingFile,
}

fn parse_bool(value: Option<&serde_yaml::Value>, key: &'static str, default_value: bool, invalid_keys: &mut Vec<&'static str>) -> bool {
    match value {
        Some(serde_yaml::Value::Bool(v)) => *v,
        Some(_) => {
            invalid_keys.push(key);
            default_value
        }
        None => default_value,
    }
}

fn parse_string(
    value: Option<&serde_yaml::Value>,
    key: &'static str,
    default_value: &str,
    allow_empty: bool,
    invalid_keys: &mut Vec<&'static str>,
) -> String {
    match value {
        Some(serde_yaml::Value::String(v)) if allow_empty || !v.trim().is_empty() => v.clone(),
        Some(serde_yaml::Value::String(_)) | Some(_) => {
            invalid_keys.push(key);
            default_value.to_string()
        }
        None => default_value.to_string(),
    }
}

fn parse_optional_string(
    value: Option<&serde_yaml::Value>,
    key: &'static str,
    invalid_keys: &mut Vec<&'static str>,
) -> Option<String> {
    match value {
        Some(serde_yaml::Value::Null) | None => None,
        Some(serde_yaml::Value::String(v)) if v.trim().is_empty() => {
            invalid_keys.push(key);
            None
        }
        Some(serde_yaml::Value::String(v)) => Some(v.clone()),
        Some(_) => {
            invalid_keys.push(key);
            None
        }
    }
}

fn parse_optional_u32(
    value: Option<&serde_yaml::Value>,
    key: &'static str,
    invalid_keys: &mut Vec<&'static str>,
) -> Option<u32> {
    match value {
        Some(serde_yaml::Value::Null) | None => None,
        Some(serde_yaml::Value::Number(n)) => n.as_u64().and_then(|v| u32::try_from(v).ok()).or_else(|| {
            invalid_keys.push(key);
            None
        }),
        Some(serde_yaml::Value::String(v)) if v.trim().is_empty() => None,
        Some(serde_yaml::Value::String(v)) => match v.parse::<u32>() {
            Ok(parsed) => Some(parsed),
            Err(_) => {
                invalid_keys.push(key);
                None
            }
        },
        Some(_) => {
            invalid_keys.push(key);
            None
        }
    }
}

fn parse_u32(
    value: Option<&serde_yaml::Value>,
    key: &'static str,
    default_value: u32,
    invalid_keys: &mut Vec<&'static str>,
) -> u32 {
    match value {
        Some(serde_yaml::Value::Number(n)) => {
            if let Some(v) = n.as_u64() {
                match u32::try_from(v) {
                    Ok(parsed) => parsed,
                    Err(_) => {
                        invalid_keys.push(key);
                        default_value
                    }
                }
            } else {
                invalid_keys.push(key);
                default_value
            }
        }
        Some(serde_yaml::Value::String(v)) => match v.parse::<u32>() {
            Ok(parsed) => parsed,
            Err(_) => {
                invalid_keys.push(key);
                default_value
            }
        },
        Some(_) => {
            invalid_keys.push(key);
            default_value
        }
        None => default_value,
    }
}

fn validate_settings_value(value: &serde_yaml::Value) -> ValidatedSettings {
    let defaults = AppSettings::default();
    let mut invalid_keys = Vec::new();
    let mapping = value.as_mapping();

    let key = |name: &'static str| serde_yaml::Value::String(name.to_string());
    let get = |name: &'static str| mapping.and_then(|map| map.get(&key(name)));

    let settings = AppSettings {
        default_model_id: parse_string(
            get("defaultModelId"),
            "defaultModelId",
            &defaults.default_model_id,
            false,
            &mut invalid_keys,
        ),
        language: parse_string(
            get("language"),
            "language",
            &defaults.language,
            false,
            &mut invalid_keys,
        ),
        translate: parse_bool(get("translate"), "translate", defaults.translate, &mut invalid_keys),
        auto_copy: parse_bool(get("autoCopy"), "autoCopy", defaults.auto_copy, &mut invalid_keys),
        start_at_login: parse_bool(
            get("startAtLogin"),
            "startAtLogin",
            defaults.start_at_login,
            &mut invalid_keys,
        ),
        live_mode: parse_bool(
            get("liveMode"),
            "liveMode",
            defaults.live_mode,
            &mut invalid_keys,
        ),
        audio_input_device_id: parse_optional_string(
            get("audioInputDeviceId"),
            "audioInputDeviceId",
            &mut invalid_keys,
        ),
        cleanup_enabled: parse_bool(
            get("cleanupEnabled"),
            "cleanupEnabled",
            defaults.cleanup_enabled,
            &mut invalid_keys,
        ),
        live_cleanup_enabled: parse_bool(
            get("liveCleanupEnabled"),
            "liveCleanupEnabled",
            defaults.live_cleanup_enabled,
            &mut invalid_keys,
        ),
        live_cleanup_mode: parse_string(
            get("liveCleanupMode"),
            "liveCleanupMode",
            &defaults.live_cleanup_mode,
            false,
            &mut invalid_keys,
        ),
        finalize_cleanup_mode: parse_string(
            get("finalizeCleanupMode"),
            "finalizeCleanupMode",
            &defaults.finalize_cleanup_mode,
            false,
            &mut invalid_keys,
        ),
        cleanup_latency_budget_ms: parse_u32(
            get("cleanupLatencyBudgetMs"),
            "cleanupLatencyBudgetMs",
            defaults.cleanup_latency_budget_ms,
            &mut invalid_keys,
        ),
        cleanup_show_raw_toggle: parse_bool(
            get("cleanupShowRawToggle"),
            "cleanupShowRawToggle",
            defaults.cleanup_show_raw_toggle,
            &mut invalid_keys,
        ),
        cleanup_backend: parse_string(
            get("cleanupBackend"),
            "cleanupBackend",
            &defaults.cleanup_backend,
            false,
            &mut invalid_keys,
        ),
        cleanup_model_id: parse_optional_string(
            get("cleanupModelId"),
            "cleanupModelId",
            &mut invalid_keys,
        ),
        history_retention_days: parse_optional_u32(
            get("historyRetentionDays"),
            "historyRetentionDays",
            &mut invalid_keys,
        ),
        history_retention_include_pinned: parse_bool(
            get("historyRetentionIncludePinned"),
            "historyRetentionIncludePinned",
            defaults.history_retention_include_pinned,
            &mut invalid_keys,
        ),
    };

    ValidatedSettings {
        settings,
        invalid_keys,
    }
}

fn load_settings_with_validation(app: &AppHandle) -> Result<(ValidatedSettings, SettingsLoadSource), String> {
    let path = app_paths::settings_path(app).map_err(String::from)?;
    if !path.exists() {
        let legacy_path = app_paths::legacy_settings_path(app).map_err(String::from)?;
        if legacy_path.exists() {
            let bytes = std::fs::read(legacy_path).map_err(|e| e.to_string())?;
            let legacy_json: serde_json::Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
            let value = serde_yaml::to_value(legacy_json).map_err(|e| e.to_string())?;
            return Ok((validate_settings_value(&value), SettingsLoadSource::MigratedLegacyJson));
        }
        return Ok((
            ValidatedSettings {
                settings: AppSettings::default(),
                invalid_keys: vec![],
            },
            SettingsLoadSource::DefaultedMissingFile,
        ));
    }

    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let value: serde_yaml::Value = serde_yaml::from_slice(&bytes).map_err(|e| e.to_string())?;
    Ok((validate_settings_value(&value), SettingsLoadSource::ExistingYaml))
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    let (validated, source) = load_settings_with_validation(&app)?;
    if source != SettingsLoadSource::ExistingYaml || !validated.invalid_keys.is_empty() {
        save_settings(app, validated.settings.clone())?;
    }
    Ok(validated.settings)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = app_paths::settings_path(&app).map_err(String::from)?;
    let body = serde_yaml::to_string(&settings).map_err(|e| e.to_string())?;
    std::fs::write(path, body).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_app_data_dir(app: AppHandle) -> Result<String, String> {
    app_paths::app_data_dir(&app)
        .map(|v| v.to_string_lossy().to_string())
        .map_err(String::from)
}

#[tauri::command]
pub fn get_settings_file_path(app: AppHandle) -> Result<String, String> {
    app_paths::settings_path(&app)
        .map(|v| v.to_string_lossy().to_string())
        .map_err(String::from)
}

pub fn validate_settings_on_startup(app: &AppHandle) -> Result<(), String> {
    let (validated, source) = load_settings_with_validation(app)?;
    if source != SettingsLoadSource::ExistingYaml || !validated.invalid_keys.is_empty() {
        save_settings(app.clone(), validated.settings)?;
    }

    if !validated.invalid_keys.is_empty() {
        let keys = validated.invalid_keys.join(", ");
        let message = format!(
            "Murmur detected invalid settings in the config file.\n\nInvalid key(s): {keys}\n\nDefault values were applied."
        );
        app.dialog()
            .message(message)
            .title("Invalid configuration")
            .kind(MessageDialogKind::Error)
            .blocking_show();
    }

    Ok(())
}

#[tauri::command]
pub fn is_start_at_login_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_start_at_login(app: AppHandle, enabled: bool) -> Result<(), String> {
    let autolaunch = app.autolaunch();
    if enabled {
        autolaunch.enable().map_err(|e| e.to_string())
    } else {
        autolaunch.disable().map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn yaml_validation_accepts_expected_keys() {
        let value: serde_yaml::Value = serde_yaml::from_str(
            r#"
defaultModelId: small
language: auto
translate: false
autoCopy: true
startAtLogin: false
liveMode: true
audioInputDeviceId: null
cleanupEnabled: true
liveCleanupEnabled: true
liveCleanupMode: rules
finalizeCleanupMode: rules
cleanupLatencyBudgetMs: 200
cleanupShowRawToggle: false
cleanupBackend: rules_only
cleanupModelId: null
"#,
        )
        .expect("valid yaml");

        let validated = validate_settings_value(&value);
        assert!(validated.invalid_keys.is_empty());
        assert_eq!(validated.settings.default_model_id, "small");
        assert!(validated.settings.auto_copy);
    }
}
