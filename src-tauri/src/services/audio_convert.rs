use crate::domain::app_error::AppError;

pub fn load_audio_as_mono_f32_16khz(path: &str) -> Result<Vec<f32>, AppError> {
    if !path.to_ascii_lowercase().ends_with(".wav") {
        return Err(AppError::InvalidInput(
            "MVP currently supports WAV input. Convert MP3/M4A to WAV first.".to_string(),
        ));
    }

    let mut reader = hound::WavReader::open(path)
        .map_err(|e| AppError::InvalidInput(format!("failed to open wav: {e}")))?;
    let spec = reader.spec();

    let raw: Result<Vec<f32>, _> = match spec.sample_format {
        hound::SampleFormat::Int => reader
            .samples::<i16>()
            .map(|s| s.map(|v| v as f32 / i16::MAX as f32))
            .collect(),
        hound::SampleFormat::Float => reader.samples::<f32>().collect(),
    };

    let mut samples = raw.map_err(|e| AppError::InvalidInput(format!("failed to read wav: {e}")))?;

    if spec.channels > 1 {
        let mut mono = Vec::with_capacity(samples.len() / spec.channels as usize);
        for chunk in samples.chunks(spec.channels as usize) {
            let sum: f32 = chunk.iter().copied().sum();
            mono.push(sum / spec.channels as f32);
        }
        samples = mono;
    }

    samples = normalize_mono_to_16khz(samples, spec.sample_rate);

    Ok(samples)
}

pub fn normalize_mono_to_16khz(samples: Vec<f32>, sample_rate: u32) -> Vec<f32> {
    if sample_rate == 16_000 {
        return samples;
    }
    resample_linear(&samples, sample_rate, 16_000)
}

fn resample_linear(input: &[f32], from_hz: u32, to_hz: u32) -> Vec<f32> {
    if input.is_empty() || from_hz == to_hz {
        return input.to_vec();
    }

    let ratio = to_hz as f64 / from_hz as f64;
    let out_len = ((input.len() as f64) * ratio).round() as usize;
    let mut out = Vec::with_capacity(out_len);

    for i in 0..out_len {
        let src_pos = i as f64 / ratio;
        let idx = src_pos.floor() as usize;
        let frac = (src_pos - idx as f64) as f32;
        let a = *input.get(idx).unwrap_or(&0.0);
        let b = *input.get(idx + 1).unwrap_or(&a);
        out.push(a + (b - a) * frac);
    }

    out
}
