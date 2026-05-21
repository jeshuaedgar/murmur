use crate::domain::app_error::AppError;
use crate::domain::transcription_history::{
    ExportBundleZipResult, ImportTranscriptionsReport, ListTranscriptionsInput,
    SaveTranscriptionInput, TranscriptionHistoryStats, TranscriptionRecord,
    UpdateTranscriptionInput,
};
use chrono::Utc;
use rusqlite::{params, params_from_iter, Connection, ToSql};
use std::io::Write;
use tauri::AppHandle;
use uuid::Uuid;
use zip::write::SimpleFileOptions;

const DB_FILE_NAME: &str = "murmur.db";

#[derive(Clone, Default)]
pub struct TranscriptionStore;

impl TranscriptionStore {
    pub fn new() -> Self {
        Self
    }

    pub fn initialize(&self, app: &AppHandle) -> Result<(), AppError> {
        let connection = open_connection(app)?;
        run_migrations(&connection)
    }

    pub fn save(
        &self,
        app: &AppHandle,
        entry: SaveTranscriptionInput,
    ) -> Result<TranscriptionRecord, AppError> {
        if entry.source_type.trim().is_empty() || entry.model_id.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "sourceType and modelId are required".to_string(),
            ));
        }
        if !matches!(entry.source_type.as_str(), "recording" | "file" | "live") {
            return Err(AppError::InvalidInput(
                "sourceType must be one of: recording, file, live".to_string(),
            ));
        }
        if entry.raw_text.trim().is_empty() || entry.cleaned_text.trim().is_empty() {
            return Err(AppError::InvalidInput(
                "rawText and cleanedText are required".to_string(),
            ));
        }

        let connection = open_connection(app)?;
        run_migrations(&connection)?;

        let now = now_iso();
        let id = entry.id.unwrap_or_else(|| Uuid::new_v4().to_string());
        let created_at = entry.created_at.unwrap_or_else(|| now.clone());

        connection.execute(
            "
            INSERT INTO transcriptions (
                id, created_at, updated_at, source_type, model_id, language, translated,
                raw_text, cleaned_text, cleanup_strategy, duration_ms, audio_path, pinned, deleted_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, NULL)
            ON CONFLICT(id) DO UPDATE SET
                updated_at=excluded.updated_at,
                source_type=excluded.source_type,
                model_id=excluded.model_id,
                language=excluded.language,
                translated=excluded.translated,
                raw_text=excluded.raw_text,
                cleaned_text=excluded.cleaned_text,
                cleanup_strategy=excluded.cleanup_strategy,
                duration_ms=excluded.duration_ms,
                audio_path=excluded.audio_path,
                pinned=excluded.pinned
            ",
            params![
                id,
                created_at,
                now,
                entry.source_type,
                entry.model_id,
                entry.language,
                if entry.translated { 1 } else { 0 },
                entry.raw_text,
                entry.cleaned_text,
                entry.cleanup_strategy,
                entry.duration_ms,
                entry.audio_path,
                if entry.pinned { 1 } else { 0 },
            ],
        )?;

        self.get(app, &id)?.ok_or_else(|| {
            AppError::Io("failed to read saved transcription from sqlite".to_string())
        })
    }

    pub fn list(
        &self,
        app: &AppHandle,
        input: ListTranscriptionsInput,
    ) -> Result<Vec<TranscriptionRecord>, AppError> {
        let connection = open_connection(app)?;
        run_migrations(&connection)?;

        let mut sql = String::from(
            "SELECT id, created_at, updated_at, source_type, model_id, language, translated, raw_text, cleaned_text, cleanup_strategy, duration_ms, audio_path, pinned, deleted_at FROM transcriptions WHERE 1=1",
        );

        let mut params: Vec<Box<dyn ToSql>> = Vec::new();

        if !input.include_deleted {
            sql.push_str(" AND deleted_at IS NULL");
        }
        if input.pinned_only {
            sql.push_str(" AND pinned = 1");
        }
        if let Some(q) = input.query.as_ref().map(|q| q.trim()).filter(|q| !q.is_empty()) {
            if let Some(match_query) = build_fts_match_query(q) {
                sql.push_str(
                    " AND id IN (
                        SELECT t.id
                        FROM transcriptions t
                        JOIN transcriptions_fts fts ON fts.rowid = t.rowid
                        WHERE transcriptions_fts MATCH ?
                    )",
                );
                params.push(Box::new(match_query));
            } else {
                sql.push_str(" AND (raw_text LIKE ? OR cleaned_text LIKE ?)");
                let pattern = format!("%{}%", q);
                params.push(Box::new(pattern.clone()));
                params.push(Box::new(pattern));
            }
        }

        sql.push_str(" ORDER BY pinned DESC, created_at DESC");
        sql.push_str(" LIMIT ? OFFSET ?");
        params.push(Box::new(i64::from(input.limit.unwrap_or(100).min(500))));
        params.push(Box::new(i64::from(input.offset.unwrap_or(0))));

        let mut statement = connection.prepare(&sql)?;
        let rows = statement.query_map(
            params_from_iter(params.iter().map(|v| &**v)),
            row_to_transcription,
        )?;

        rows.collect::<Result<Vec<_>, _>>().map_err(AppError::from)
    }

    pub fn get(&self, app: &AppHandle, id: &str) -> Result<Option<TranscriptionRecord>, AppError> {
        let connection = open_connection(app)?;
        run_migrations(&connection)?;

        let mut statement = connection.prepare(
            "SELECT id, created_at, updated_at, source_type, model_id, language, translated, raw_text, cleaned_text, cleanup_strategy, duration_ms, audio_path, pinned, deleted_at FROM transcriptions WHERE id = ?1",
        )?;

        let result = statement.query_row(params![id], row_to_transcription);
        match result {
            Ok(record) => Ok(Some(record)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    pub fn update(
        &self,
        app: &AppHandle,
        id: &str,
        patch: UpdateTranscriptionInput,
    ) -> Result<TranscriptionRecord, AppError> {
        let existing = self
            .get(app, id)?
            .ok_or_else(|| AppError::NotFound(format!("transcription not found: {id}")))?;

        let updated = SaveTranscriptionInput {
            id: Some(existing.id),
            created_at: Some(existing.created_at),
            source_type: patch.source_type.unwrap_or(existing.source_type),
            model_id: patch.model_id.unwrap_or(existing.model_id),
            language: patch.language.or(existing.language),
            translated: patch.translated.unwrap_or(existing.translated),
            raw_text: patch.raw_text.unwrap_or(existing.raw_text),
            cleaned_text: patch.cleaned_text.unwrap_or(existing.cleaned_text),
            cleanup_strategy: patch.cleanup_strategy.unwrap_or(existing.cleanup_strategy),
            duration_ms: patch.duration_ms.or(existing.duration_ms),
            audio_path: patch.audio_path.or(existing.audio_path),
            pinned: patch.pinned.unwrap_or(existing.pinned),
        };

        self.save(app, updated)
    }

    pub fn soft_delete(&self, app: &AppHandle, id: &str) -> Result<(), AppError> {
        let connection = open_connection(app)?;
        run_migrations(&connection)?;

        let changed = connection.execute(
            "UPDATE transcriptions SET deleted_at = ?1, updated_at = ?2 WHERE id = ?3",
            params![now_iso(), now_iso(), id],
        )?;

        if changed == 0 {
            return Err(AppError::NotFound(format!("transcription not found: {id}")));
        }
        Ok(())
    }

    pub fn hard_delete(&self, app: &AppHandle, id: &str) -> Result<(), AppError> {
        let connection = open_connection(app)?;
        run_migrations(&connection)?;
        let changed = connection.execute("DELETE FROM transcriptions WHERE id = ?1", params![id])?;
        if changed == 0 {
            return Err(AppError::NotFound(format!("transcription not found: {id}")));
        }
        Ok(())
    }

    pub fn restore(&self, app: &AppHandle, id: &str) -> Result<(), AppError> {
        let connection = open_connection(app)?;
        run_migrations(&connection)?;
        let changed = connection.execute(
            "UPDATE transcriptions SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
            params![now_iso(), id],
        )?;
        if changed == 0 {
            return Err(AppError::NotFound(format!("transcription not found: {id}")));
        }
        Ok(())
    }

    pub fn export_json(&self, app: &AppHandle, include_deleted: bool) -> Result<String, AppError> {
        let entries = self.list(
            app,
            ListTranscriptionsInput {
                limit: Some(10_000),
                offset: Some(0),
                include_deleted,
                pinned_only: false,
                query: None,
            },
        )?;
        serde_json::to_string_pretty(&entries).map_err(AppError::from)
    }

    pub fn export_csv(&self, app: &AppHandle, include_deleted: bool) -> Result<String, AppError> {
        let entries = self.list(
            app,
            ListTranscriptionsInput {
                limit: Some(10_000),
                offset: Some(0),
                include_deleted,
                pinned_only: false,
                query: None,
            },
        )?;

        let mut output = String::from("id,created_at,updated_at,source_type,model_id,language,translated,cleanup_strategy,duration_ms,audio_path,pinned,deleted_at,raw_text,cleaned_text\n");
        for item in entries {
            let raw = escape_csv(&item.raw_text);
            let cleaned = escape_csv(&item.cleaned_text);
            let audio = escape_csv(item.audio_path.as_deref().unwrap_or(""));
            let language = escape_csv(item.language.as_deref().unwrap_or(""));
            let deleted = escape_csv(item.deleted_at.as_deref().unwrap_or(""));
            output.push_str(&format!(
                "\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",{},\"{}\",{},\"{}\",{},\"{}\",\"{}\",\"{}\"\n",
                item.id,
                item.created_at,
                item.updated_at,
                item.source_type,
                item.model_id,
                language,
                if item.translated { 1 } else { 0 },
                item.cleanup_strategy,
                item.duration_ms.unwrap_or(0),
                audio,
                if item.pinned { 1 } else { 0 },
                deleted,
                raw,
                cleaned,
            ));
        }

        Ok(output)
    }

    pub fn export_bundle_zip(
        &self,
        app: &AppHandle,
        include_deleted: bool,
    ) -> Result<ExportBundleZipResult, AppError> {
        let entries = self.list(
            app,
            ListTranscriptionsInput {
                limit: Some(10_000),
                offset: Some(0),
                include_deleted,
                pinned_only: false,
                query: None,
            },
        )?;

        let csv = self.export_csv(app, include_deleted)?;
        let mut zip_buffer = std::io::Cursor::new(Vec::<u8>::new());
        let mut zip_writer = zip::ZipWriter::new(&mut zip_buffer);
        let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        zip_writer
            .start_file("history.csv", options)
            .map_err(|e| AppError::Io(format!("zip start history.csv failed: {e}")))?;
        zip_writer
            .write_all(csv.as_bytes())
            .map_err(|e| AppError::Io(format!("zip write history.csv failed: {e}")))?;

        let mut manifest = String::from("id,audio_path,bundled\n");
        let total_entries = entries.len();
        let mut audio_referenced = 0usize;
        let mut audio_included = 0usize;
        let mut audio_missing = 0usize;

        for entry in entries {
            let Some(audio_path) = entry.audio_path else {
                continue;
            };
            audio_referenced += 1;

            let audio_file = std::path::PathBuf::from(&audio_path);
            if !audio_file.exists() {
                audio_missing += 1;
                manifest.push_str(&format!("\"{}\",\"{}\",false\n", entry.id, escape_csv(&audio_path)));
                continue;
            }

            let file_name = audio_file
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("audio.wav");
            let zip_entry_name = format!("audio/{}", file_name);
            let bytes = std::fs::read(&audio_file)?;

            zip_writer
                .start_file(zip_entry_name, options)
                .map_err(|e| AppError::Io(format!("zip start audio file failed: {e}")))?;
            zip_writer
                .write_all(&bytes)
                .map_err(|e| AppError::Io(format!("zip write audio file failed: {e}")))?;
            audio_included += 1;

            manifest.push_str(&format!("\"{}\",\"{}\",true\n", entry.id, escape_csv(&audio_path)));
        }

        zip_writer
            .start_file("audio-manifest.csv", options)
            .map_err(|e| AppError::Io(format!("zip start audio-manifest.csv failed: {e}")))?;
        zip_writer
            .write_all(manifest.as_bytes())
            .map_err(|e| AppError::Io(format!("zip write audio-manifest.csv failed: {e}")))?;

        zip_writer
            .finish()
            .map_err(|e| AppError::Io(format!("zip finalize failed: {e}")))?;

        Ok(ExportBundleZipResult {
            bytes: zip_buffer.into_inner(),
            total_entries,
            audio_referenced,
            audio_included,
            audio_missing,
        })
    }

    pub fn import_json(
        &self,
        app: &AppHandle,
        payload: &str,
    ) -> Result<ImportTranscriptionsReport, AppError> {
        let entries: Vec<TranscriptionRecord> = serde_json::from_str(payload)?;
        let mut report = ImportTranscriptionsReport {
            imported: 0,
            skipped: 0,
            failed: 0,
            errors: Vec::new(),
        };

        for entry in entries {
            let entry_id = entry.id.clone();
            let save_result = self.save(
                app,
                SaveTranscriptionInput {
                    id: Some(entry_id.clone()),
                    created_at: Some(entry.created_at),
                    source_type: entry.source_type,
                    model_id: entry.model_id,
                    language: entry.language,
                    translated: entry.translated,
                    raw_text: entry.raw_text,
                    cleaned_text: entry.cleaned_text,
                    cleanup_strategy: entry.cleanup_strategy,
                    duration_ms: entry.duration_ms,
                    audio_path: entry.audio_path,
                    pinned: entry.pinned,
                },
            );

            if let Err(error) = save_result {
                report.failed += 1;
                report
                    .errors
                    .push(format!("{}: {}", entry_id, error));
                continue;
            }

            if let Some(deleted_at) = entry.deleted_at {
                let connection = open_connection(app)?;
                run_migrations(&connection)?;
                connection.execute(
                    "UPDATE transcriptions SET deleted_at = ?1, updated_at = ?2 WHERE id = ?3",
                    params![deleted_at, now_iso(), entry_id],
                )?;
            }

            report.imported += 1;
        }

        Ok(report)
    }

    pub fn stats(&self, app: &AppHandle) -> Result<TranscriptionHistoryStats, AppError> {
        let connection = open_connection(app)?;
        run_migrations(&connection)?;

        let total_count: i64 = connection.query_row(
            "SELECT COUNT(*) FROM transcriptions WHERE deleted_at IS NULL",
            [],
            |row| row.get(0),
        )?;
        let pinned_count: i64 = connection.query_row(
            "SELECT COUNT(*) FROM transcriptions WHERE deleted_at IS NULL AND pinned = 1",
            [],
            |row| row.get(0),
        )?;
        let deleted_count: i64 = connection.query_row(
            "SELECT COUNT(*) FROM transcriptions WHERE deleted_at IS NOT NULL",
            [],
            |row| row.get(0),
        )?;
        let avg_duration_ms: Option<f64> = connection.query_row(
            "SELECT AVG(duration_ms) FROM transcriptions WHERE deleted_at IS NULL AND duration_ms IS NOT NULL",
            [],
            |row| row.get(0),
        )?;

        Ok(TranscriptionHistoryStats {
            total_count,
            pinned_count,
            deleted_count,
            avg_duration_ms,
        })
    }

    pub fn apply_retention(&self, app: &AppHandle, days: u32, include_pinned: bool) -> Result<usize, AppError> {
        let connection = open_connection(app)?;
        run_migrations(&connection)?;
        let cutoff = (Utc::now() - chrono::Duration::days(days as i64)).to_rfc3339();
        let sql = if include_pinned {
            "UPDATE transcriptions SET deleted_at = ?1, updated_at = ?1 WHERE deleted_at IS NULL AND created_at < ?2"
        } else {
            "UPDATE transcriptions SET deleted_at = ?1, updated_at = ?1 WHERE deleted_at IS NULL AND pinned = 0 AND created_at < ?2"
        };
        let changed = connection.execute(sql, params![now_iso(), cutoff])?;
        Ok(changed)
    }
}

fn escape_csv(value: &str) -> String {
    value.replace('"', "\"\"").replace('\n', " ")
}

fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

fn open_connection(app: &AppHandle) -> Result<Connection, AppError> {
    let mut path = crate::services::app_paths::app_data_dir(app)?;
    path.push(DB_FILE_NAME);
    Connection::open(path).map_err(AppError::from)
}

fn run_migrations(connection: &Connection) -> Result<(), AppError> {
    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS transcriptions (
            id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            source_type TEXT NOT NULL,
            model_id TEXT NOT NULL,
            language TEXT NULL,
            translated INTEGER NOT NULL DEFAULT 0,
            raw_text TEXT NOT NULL,
            cleaned_text TEXT NOT NULL,
            cleanup_strategy TEXT NOT NULL,
            duration_ms INTEGER NULL,
            audio_path TEXT NULL,
            pinned INTEGER NOT NULL DEFAULT 0,
            deleted_at TEXT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at
            ON transcriptions(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_transcriptions_pinned_created
            ON transcriptions(pinned DESC, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_transcriptions_search
            ON transcriptions(cleaned_text, raw_text);

        CREATE VIRTUAL TABLE IF NOT EXISTS transcriptions_fts
        USING fts5(raw_text, cleaned_text, content='transcriptions', content_rowid='rowid');

        CREATE TRIGGER IF NOT EXISTS transcriptions_ai AFTER INSERT ON transcriptions BEGIN
          INSERT INTO transcriptions_fts(rowid, raw_text, cleaned_text) VALUES (new.rowid, new.raw_text, new.cleaned_text);
        END;

        CREATE TRIGGER IF NOT EXISTS transcriptions_ad AFTER DELETE ON transcriptions BEGIN
          INSERT INTO transcriptions_fts(transcriptions_fts, rowid, raw_text, cleaned_text) VALUES('delete', old.rowid, old.raw_text, old.cleaned_text);
        END;

        CREATE TRIGGER IF NOT EXISTS transcriptions_au AFTER UPDATE ON transcriptions BEGIN
          INSERT INTO transcriptions_fts(transcriptions_fts, rowid, raw_text, cleaned_text) VALUES('delete', old.rowid, old.raw_text, old.cleaned_text);
          INSERT INTO transcriptions_fts(rowid, raw_text, cleaned_text) VALUES (new.rowid, new.raw_text, new.cleaned_text);
        END;

        INSERT INTO transcriptions_fts(transcriptions_fts) VALUES('rebuild');
        ",
    )?;
    Ok(())
}

fn build_fts_match_query(input: &str) -> Option<String> {
    let terms = input
        .split(|c: char| !c.is_alphanumeric())
        .filter_map(|part| {
            let term = part.trim();
            if term.is_empty() {
                None
            } else {
                Some(format!("{}*", term))
            }
        })
        .collect::<Vec<_>>();

    if terms.is_empty() {
        None
    } else {
        Some(terms.join(" AND "))
    }
}

fn row_to_transcription(row: &rusqlite::Row<'_>) -> rusqlite::Result<TranscriptionRecord> {
    Ok(TranscriptionRecord {
        id: row.get(0)?,
        created_at: row.get(1)?,
        updated_at: row.get(2)?,
        source_type: row.get(3)?,
        model_id: row.get(4)?,
        language: row.get(5)?,
        translated: row.get::<_, i64>(6)? == 1,
        raw_text: row.get(7)?,
        cleaned_text: row.get(8)?,
        cleanup_strategy: row.get(9)?,
        duration_ms: row.get(10)?,
        audio_path: row.get(11)?,
        pinned: row.get::<_, i64>(12)? == 1,
        deleted_at: row.get(13)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migration_creates_table_and_indexes() {
        let connection = Connection::open_in_memory().expect("in-memory sqlite");
        run_migrations(&connection).expect("migrations");

        let count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='transcriptions'",
                [],
                |row| row.get(0),
            )
            .expect("query table count");

        assert_eq!(count, 1);
    }

    #[test]
    fn soft_delete_and_restore_flow() {
        let connection = Connection::open_in_memory().expect("in-memory sqlite");
        run_migrations(&connection).expect("migrations");

        connection
            .execute(
                "INSERT INTO transcriptions (id, created_at, updated_at, source_type, model_id, language, translated, raw_text, cleaned_text, cleanup_strategy, duration_ms, audio_path, pinned, deleted_at)
                 VALUES (?1, ?2, ?3, 'recording', 'small', NULL, 0, 'raw', 'clean', 'rules', NULL, NULL, 0, NULL)",
                params!["id-1", now_iso(), now_iso()],
            )
            .expect("insert");

        connection
            .execute(
                "UPDATE transcriptions SET deleted_at = ?1 WHERE id = ?2",
                params![now_iso(), "id-1"],
            )
            .expect("soft delete");

        let deleted: Option<String> = connection
            .query_row(
                "SELECT deleted_at FROM transcriptions WHERE id = ?1",
                params!["id-1"],
                |row| row.get(0),
            )
            .expect("query deleted_at");
        assert!(deleted.is_some());

        connection
            .execute(
                "UPDATE transcriptions SET deleted_at = NULL WHERE id = ?1",
                params!["id-1"],
            )
            .expect("restore");

        let restored: Option<String> = connection
            .query_row(
                "SELECT deleted_at FROM transcriptions WHERE id = ?1",
                params!["id-1"],
                |row| row.get(0),
            )
            .expect("query restored");
        assert!(restored.is_none());
    }
}
