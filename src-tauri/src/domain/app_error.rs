use serde::Serialize;
use std::fmt::{Display, Formatter};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppErrorPayload {
    pub code: String,
    pub message: String,
    pub detail: Option<String>,
}

#[derive(Debug)]
pub enum AppError {
    NotFound(String),
    InvalidInput(String),
    Io(String),
    Network(String),
    Engine(String),
    Conflict(String),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::NotFound(_) => "not_found",
            Self::InvalidInput(_) => "invalid_input",
            Self::Io(_) => "io_error",
            Self::Network(_) => "network_error",
            Self::Engine(_) => "engine_error",
            Self::Conflict(_) => "conflict",
        }
    }

    pub fn payload(&self) -> AppErrorPayload {
        AppErrorPayload {
            code: self.code().to_string(),
            message: self.to_string(),
            detail: None,
        }
    }
}

impl Display for AppError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound(msg)
            | Self::InvalidInput(msg)
            | Self::Io(msg)
            | Self::Network(msg)
            | Self::Engine(msg)
            | Self::Conflict(msg) => write!(f, "{}", msg),
        }
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value.to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(value: reqwest::Error) -> Self {
        if value.is_timeout() || value.is_connect() {
            Self::Network(value.to_string())
        } else {
            Self::Io(value.to_string())
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(value: serde_json::Error) -> Self {
        Self::InvalidInput(value.to_string())
    }
}

impl From<AppError> for String {
    fn from(value: AppError) -> Self {
        serde_json::to_string(&value.payload()).unwrap_or_else(|_| value.to_string())
    }
}
