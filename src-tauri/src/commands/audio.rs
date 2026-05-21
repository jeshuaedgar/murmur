use cpal::traits::{DeviceTrait, HostTrait};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioInputDevice {
    pub id: String,
    pub label: String,
    pub is_default: bool,
}

#[tauri::command]
pub fn get_audio_inputs() -> Result<Vec<AudioInputDevice>, String> {
    let host = cpal::default_host();
    let default_name = host.default_input_device().and_then(|d| d.name().ok());
    let devices = host
        .input_devices()
        .map_err(|e| format!("failed to enumerate input devices: {e}"))?;

    let mut output = Vec::new();
    for (idx, device) in devices.enumerate() {
        let label = device
            .name()
            .unwrap_or_else(|_| format!("Input device {}", idx + 1));
        let is_default = default_name
            .as_ref()
            .map(|name| name == &label)
            .unwrap_or(false);
        output.push(AudioInputDevice {
            id: format!("cpal-{idx}"),
            label,
            is_default,
        });
    }

    Ok(output)
}
