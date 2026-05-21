use crate::domain::transcription_result::{CleanupTextOptions, CleanupTextResult};
use regex::Regex;

pub struct CleanupService {
    fillers: Vec<Regex>,
    punctuation_spacing: Regex,
    punctuation_dedup: Regex,
    whitespace_dedup: Regex,
}

impl CleanupService {
    pub fn new() -> Self {
        Self {
            fillers: vec![
                Regex::new(r"(?i)\buh+\b").expect("valid filler regex"),
                Regex::new(r"(?i)\bum+\b").expect("valid filler regex"),
                Regex::new(r"(?i)\ber+\b").expect("valid filler regex"),
                Regex::new(r"(?i)\bah+\b").expect("valid filler regex"),
                Regex::new(r"(?i)\byou\s+know\b").expect("valid filler regex"),
                Regex::new(r"(?i)\bi\s+mean\b").expect("valid filler regex"),
            ],
            punctuation_spacing: Regex::new(r"\s+([,.!?;:])").expect("valid punctuation spacing regex"),
            punctuation_dedup: Regex::new(r"([,.!?;:]){2,}").expect("valid punctuation dedupe regex"),
            whitespace_dedup: Regex::new(r"\s{2,}").expect("valid whitespace dedupe regex"),
        }
    }

    fn collapse_repeated_tokens(&self, text: &str) -> String {
        let mut output = String::new();
        let mut previous_lower: Option<String> = None;
        for token in text.split_whitespace() {
            let current_lower = token.to_lowercase();
            if previous_lower.as_deref() == Some(current_lower.as_str()) {
                continue;
            }
            if !output.is_empty() {
                output.push(' ');
            }
            output.push_str(token);
            previous_lower = Some(current_lower);
        }
        output
    }

    pub fn cleanup_text(&self, text: &str, options: &CleanupTextOptions) -> CleanupTextResult {
        let mode = options.mode.as_deref().unwrap_or("rules");
        if mode == "off" {
            return CleanupTextResult {
                raw_text: text.to_string(),
                cleaned_text: text.to_string(),
                strategy: "raw".to_string(),
                rejected_reason: None,
            };
        }

        let mut output = text.to_string();
        for filler in &self.fillers {
            output = filler.replace_all(&output, " ").to_string();
        }

        output = self.collapse_repeated_tokens(&output);
        output = self.punctuation_spacing.replace_all(&output, "$1").to_string();
        output = self.punctuation_dedup.replace_all(&output, "$1").to_string();
        output = self.whitespace_dedup.replace_all(&output, " ").trim().to_string();

        CleanupTextResult {
            raw_text: text.to_string(),
            cleaned_text: output,
            strategy: if mode == "rules_plus_model" {
                "rules"
            } else {
                "rules"
            }
            .to_string(),
            rejected_reason: if mode == "rules_plus_model" {
                Some("model_pipeline_not_yet_enabled".to_string())
            } else {
                None
            },
        }
    }
}
