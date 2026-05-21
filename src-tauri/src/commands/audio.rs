#[tauri::command]
pub fn get_audio_inputs() -> Result<Vec<String>, String> {
    Ok(vec!["Default Input Device".to_string()])
}
