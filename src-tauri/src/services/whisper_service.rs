use crate::domain::app_error::AppError;
use crate::domain::transcription_result::{TranscriptionOptions, TranscriptionResult, TranscriptionSegment};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Instant;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

pub struct WhisperService {
    loaded_model: Mutex<Option<(String, WhisperContext)>>,
}

impl WhisperService {
    pub fn new() -> Self {
        Self {
            loaded_model: Mutex::new(None),
        }
    }

    pub fn transcribe_audio(
        &self,
        model_id: &str,
        model_path: PathBuf,
        audio: Vec<f32>,
        options: &TranscriptionOptions,
    ) -> Result<TranscriptionResult, AppError> {
        let start = Instant::now();

        let mut guard = self
            .loaded_model
            .lock()
            .map_err(|_| AppError::Engine("model cache lock poisoned".to_string()))?;

        let should_reload = guard
            .as_ref()
            .map(|(loaded_id, _)| loaded_id != model_id)
            .unwrap_or(true);

        if should_reload {
            let path_str = model_path.to_string_lossy().to_string();
            let params = WhisperContextParameters::default();
            let ctx = WhisperContext::new_with_params(&path_str, params)
                .map_err(|e| AppError::Engine(format!("failed to load model: {e}")))?;
            *guard = Some((model_id.to_string(), ctx));
        }

        let (_, ctx) = guard
            .as_mut()
            .ok_or_else(|| AppError::Engine("model context missing".to_string()))?;

        let mut state = ctx
            .create_state()
            .map_err(|e| AppError::Engine(format!("failed to create whisper state: {e}")))?;

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_n_threads(num_cpus::get().clamp(1, 8) as i32);
        params.set_translate(options.translate.unwrap_or(false));
        if let Some(lang) = &options.language {
            if !lang.is_empty() {
                params.set_language(Some(lang));
            }
        }

        state
            .full(params, &audio)
            .map_err(|e| AppError::Engine(format!("transcription failed: {e}")))?;

        let mut text = String::new();
        let mut segments = Vec::new();
        let n_segments = state.full_n_segments().unwrap_or(0);
        for i in 0..n_segments {
            let segment_text = state
                .full_get_segment_text(i)
                .map_err(|e| AppError::Engine(format!("segment text error: {e}")))?;
            let t0 = state.full_get_segment_t0(i).unwrap_or(0) as f32 / 100.0;
            let t1 = state.full_get_segment_t1(i).unwrap_or(0) as f32 / 100.0;
            text.push_str(&segment_text);
            segments.push(TranscriptionSegment {
                start_sec: t0,
                end_sec: t1,
                text: segment_text,
            });
        }

        Ok(TranscriptionResult {
            text: text.trim().to_string(),
            language: options.language.clone(),
            duration_ms: start.elapsed().as_millis(),
            segments,
        })
    }
}
