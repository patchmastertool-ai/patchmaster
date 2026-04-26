-- PatchMaster backup enhancements migration
-- Adds storage metadata and run stats to backup_configs and backup_logs.

ALTER TABLE backup_configs
    ADD COLUMN IF NOT EXISTS storage_type VARCHAR(50) DEFAULT 'local',
    ADD COLUMN IF NOT EXISTS storage_config JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS last_test_status VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS last_run_status VARCHAR(50) DEFAULT '',
    ADD COLUMN IF NOT EXISTS last_run_size INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_run_duration DOUBLE PRECISION DEFAULT 0.0;

-- keep existing storage_path; ensure default remains null

ALTER TABLE backup_logs
    ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS duration_seconds DOUBLE PRECISION DEFAULT 0.0;

-- Optional: recalc indexes if needed (none required here).

-- To apply (PostgreSQL):
-- psql "$DATABASE_URL" -f scripts/migrations/20260311_add_backup_storage_columns.sql
