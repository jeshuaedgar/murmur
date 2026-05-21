use crate::domain::app_error::AppError;
use std::fs::File;
use std::path::Path;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::formats::FormatOptions;
use symphonia::core::io::{MediaSourceStream, MediaSourceStreamOptions};
use symphonia::core::meta::MetadataOptions;
use symphonia::core::probe::Hint;

pub fn load_audio_as_mono_f32_16khz(path: &str) -> Result<Vec<f32>, AppError> {
    let ext = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .ok_or_else(|| {
            AppError::UnsupportedMedia(
                "Unsupported audio format. Please choose a WAV, MP3, or M4A file.".to_string(),
            )
        })?;

    let samples = match ext.as_str() {
        "wav" => decode_wav(path)?,
        "mp3" | "m4a" => decode_with_symphonia(path, &ext)?,
        _ => {
            return Err(AppError::UnsupportedMedia(
                "Unsupported audio format. Please choose a WAV, MP3, or M4A file.".to_string(),
            ));
        }
    };

    Ok(samples)
}

fn decode_wav(path: &str) -> Result<Vec<f32>, AppError> {
    let mut reader = hound::WavReader::open(path).map_err(|e| {
        let detail = e.to_string();
        if detail.contains("No such file") || detail.contains("Permission denied") {
            AppError::Io(format!("failed to open audio file: {detail}"))
        } else {
            AppError::AudioDecode(format!("Could not decode the selected audio file: {detail}"))
        }
    })?;
    let spec = reader.spec();

    let raw: Result<Vec<f32>, _> = match spec.sample_format {
        hound::SampleFormat::Int => reader
            .samples::<i16>()
            .map(|s| s.map(|v| v as f32 / i16::MAX as f32))
            .collect(),
        hound::SampleFormat::Float => reader.samples::<f32>().collect(),
    };

    let mut samples = raw
        .map_err(|e| AppError::AudioDecode(format!("Could not decode the selected audio file: {e}")))?;

    if spec.channels > 1 {
        samples = downmix_interleaved_to_mono(samples, spec.channels as usize);
    }

    Ok(normalize_mono_to_16khz(samples, spec.sample_rate))
}

fn decode_with_symphonia(path: &str, ext: &str) -> Result<Vec<f32>, AppError> {
    let file = File::open(path).map_err(|e| AppError::Io(format!("failed to open audio file: {e}")))?;
    let stream = MediaSourceStream::new(Box::new(file), MediaSourceStreamOptions::default());

    let mut hint = Hint::new();
    hint.with_extension(ext);

    let mut probed = symphonia::default::get_probe()
        .format(
            &hint,
            stream,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(map_symphonia_error)?;

    let track = probed
        .format
        .tracks()
        .iter()
        .find(|candidate| candidate.codec_params.sample_rate.is_some())
        .ok_or_else(|| {
            AppError::AudioDecode("No decodable audio track was found in the selected file.".to_string())
        })?;

    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(map_symphonia_error)?;

    let sample_rate = track.codec_params.sample_rate.ok_or_else(|| {
        AppError::AudioDecode("Could not determine the input sample rate for this audio file.".to_string())
    })?;

    let channels = track
        .codec_params
        .channels
        .map(|layout| layout.count() as usize)
        .ok_or_else(|| {
            AppError::AudioDecode("Could not determine the input channel layout for this audio file.".to_string())
        })?;

    let mut interleaved = Vec::<f32>::new();

    loop {
        let packet = match probed.format.next_packet() {
            Ok(packet) => packet,
            Err(SymphoniaError::IoError(error)) if error.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(error) => return Err(map_symphonia_error(error)),
        };

        let decoded = match decoder.decode(&packet) {
            Ok(decoded) => decoded,
            Err(SymphoniaError::DecodeError(_)) => continue,
            Err(SymphoniaError::IoError(error)) if error.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(error) => return Err(map_symphonia_error(error)),
        };

        let spec = *decoded.spec();
        let mut sample_buffer = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
        sample_buffer.copy_interleaved_ref(decoded);
        interleaved.extend_from_slice(sample_buffer.samples());
    }

    if interleaved.is_empty() {
        return Err(AppError::AudioDecode(
            "Could not decode audio data from the selected file.".to_string(),
        ));
    }

    let mono = if channels > 1 {
        downmix_interleaved_to_mono(interleaved, channels)
    } else {
        interleaved
    };

    Ok(normalize_mono_to_16khz(mono, sample_rate))
}

fn downmix_interleaved_to_mono(samples: Vec<f32>, channels: usize) -> Vec<f32> {
    if channels <= 1 {
        return samples;
    }
    let mut mono = Vec::with_capacity(samples.len() / channels);
    for chunk in samples.chunks(channels) {
        let sum: f32 = chunk.iter().copied().sum();
        mono.push(sum / channels as f32);
    }
    mono
}

fn map_symphonia_error(error: SymphoniaError) -> AppError {
    match error {
        SymphoniaError::Unsupported(detail) => AppError::MissingCodec(format!(
            "This audio codec is not available in the current build: {detail}"
        )),
        SymphoniaError::DecodeError(detail) => {
            AppError::AudioDecode(format!("Could not decode the selected audio file: {detail}"))
        }
        SymphoniaError::IoError(detail) => AppError::Io(format!("audio file IO error: {detail}")),
        other => AppError::AudioDecode(format!("Could not decode the selected audio file: {other}")),
    }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn temp_path(ext: &str) -> PathBuf {
        std::env::temp_dir().join(format!("whisper-audio-convert-{}.{}", Uuid::new_v4(), ext))
    }

    #[test]
    fn rejects_unsupported_extension() {
        let path = temp_path("flac");
        fs::write(&path, b"not-a-real-flac").expect("write test file");
        let err = load_audio_as_mono_f32_16khz(path.to_str().expect("utf8 path")).expect_err("should reject extension");
        assert!(matches!(err, AppError::UnsupportedMedia(_)));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn handles_decode_failure_for_mp3() {
        let path = temp_path("mp3");
        fs::write(&path, b"not-a-real-mp3").expect("write test file");
        let err = load_audio_as_mono_f32_16khz(path.to_str().expect("utf8 path")).expect_err("should fail decode");
        assert!(matches!(err, AppError::AudioDecode(_) | AppError::MissingCodec(_) | AppError::Io(_)));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn handles_decode_failure_for_m4a() {
        let path = temp_path("m4a");
        fs::write(&path, b"not-a-real-m4a").expect("write test file");
        let err = load_audio_as_mono_f32_16khz(path.to_str().expect("utf8 path")).expect_err("should fail decode");
        assert!(matches!(err, AppError::AudioDecode(_) | AppError::MissingCodec(_) | AppError::Io(_)));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn wav_path_still_works_and_resamples() {
        let path = temp_path("wav");
        let spec = hound::WavSpec {
            channels: 2,
            sample_rate: 8_000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        {
            let mut writer = hound::WavWriter::create(&path, spec).expect("create wav");
            // 0.1 seconds stereo tone-ish data at 8k.
            for i in 0..800 {
                let value = ((i as f32 / 800.0) * i16::MAX as f32 * 0.3) as i16;
                writer.write_sample(value).expect("left sample");
                writer.write_sample(value).expect("right sample");
            }
            writer.finalize().expect("finalize wav");
        }

        let samples =
            load_audio_as_mono_f32_16khz(path.to_str().expect("utf8 path")).expect("wav should decode");
        assert!(!samples.is_empty());
        // 0.1s @16k after resample.
        assert_eq!(samples.len(), 1600);
        let _ = fs::remove_file(path);
    }
}
