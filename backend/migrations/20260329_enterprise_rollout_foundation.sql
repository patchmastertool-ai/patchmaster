-- PatchMaster enterprise rollout hardening migration
-- Adds schema for:
--   - plugin integrations + delivery logs
--   - ring rollout policy/runs
--   - restore drill runs

CREATE TABLE IF NOT EXISTS plugin_integrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    plugin_type VARCHAR(50) NOT NULL DEFAULT 'webhook',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    secret VARCHAR(255) NOT NULL DEFAULT '',
    max_attempts INTEGER NOT NULL DEFAULT 3,
    retry_backoff_seconds JSONB NOT NULL DEFAULT '[5,20,60]'::jsonb,
    created_by VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_plugin_integrations_name ON plugin_integrations (name);
CREATE INDEX IF NOT EXISTS ix_plugin_integrations_type ON plugin_integrations (plugin_type);
CREATE INDEX IF NOT EXISTS ix_plugin_integrations_enabled ON plugin_integrations (is_enabled);

CREATE TABLE IF NOT EXISTS plugin_delivery_logs (
    id SERIAL PRIMARY KEY,
    plugin_id INTEGER NOT NULL REFERENCES plugin_integrations(id) ON DELETE CASCADE,
    event_type VARCHAR(120) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    request_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_status INTEGER NULL,
    response_body TEXT NOT NULL DEFAULT '',
    error TEXT NOT NULL DEFAULT '',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMP NULL,
    last_attempt_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_plugin_delivery_logs_plugin_id ON plugin_delivery_logs (plugin_id);
CREATE INDEX IF NOT EXISTS ix_plugin_delivery_logs_status ON plugin_delivery_logs (status);
CREATE INDEX IF NOT EXISTS ix_plugin_delivery_logs_created_at ON plugin_delivery_logs (created_at);
CREATE INDEX IF NOT EXISTS ix_plugin_delivery_logs_status_retry ON plugin_delivery_logs (status, next_retry_at);

CREATE TABLE IF NOT EXISTS ring_rollout_policies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    target_os_family VARCHAR(30) NOT NULL DEFAULT 'linux',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    rings JSONB NOT NULL DEFAULT '[]'::jsonb,
    guardrails JSONB NOT NULL DEFAULT '{}'::jsonb,
    rollout_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_ring_rollout_policies_name ON ring_rollout_policies (name);
CREATE INDEX IF NOT EXISTS ix_ring_rollout_policies_family ON ring_rollout_policies (target_os_family);
CREATE INDEX IF NOT EXISTS ix_ring_rollout_policies_enabled ON ring_rollout_policies (is_enabled);

CREATE TABLE IF NOT EXISTS ring_rollout_runs (
    id SERIAL PRIMARY KEY,
    policy_id INTEGER NOT NULL REFERENCES ring_rollout_policies(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    action VARCHAR(30) NOT NULL DEFAULT 'upgrade',
    dry_run BOOLEAN NOT NULL DEFAULT FALSE,
    requested_by VARCHAR(100) NOT NULL DEFAULT '',
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    queue_job_id VARCHAR(64) NOT NULL DEFAULT '',
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_ring_rollout_runs_policy_id ON ring_rollout_runs (policy_id);
CREATE INDEX IF NOT EXISTS ix_ring_rollout_runs_status ON ring_rollout_runs (status);
CREATE INDEX IF NOT EXISTS ix_ring_rollout_runs_queue_job_id ON ring_rollout_runs (queue_job_id);
CREATE INDEX IF NOT EXISTS ix_ring_rollout_runs_policy_created ON ring_rollout_runs (policy_id, created_at);

CREATE TABLE IF NOT EXISTS restore_drill_runs (
    id SERIAL PRIMARY KEY,
    config_id INTEGER NOT NULL REFERENCES backup_configs(id) ON DELETE CASCADE,
    host_id INTEGER NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
    backup_log_id INTEGER NULL REFERENCES backup_logs(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    requested_by VARCHAR(100) NOT NULL DEFAULT '',
    target_path VARCHAR(255) NOT NULL DEFAULT '',
    target_rto_minutes DOUBLE PRECISION NULL,
    target_rpo_minutes DOUBLE PRECISION NULL,
    actual_rto_seconds DOUBLE PRECISION NULL,
    actual_rpo_minutes DOUBLE PRECISION NULL,
    within_sla BOOLEAN NULL,
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    queue_job_id VARCHAR(64) NOT NULL DEFAULT '',
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_restore_drill_runs_config_id ON restore_drill_runs (config_id);
CREATE INDEX IF NOT EXISTS ix_restore_drill_runs_host_id ON restore_drill_runs (host_id);
CREATE INDEX IF NOT EXISTS ix_restore_drill_runs_status ON restore_drill_runs (status);
CREATE INDEX IF NOT EXISTS ix_restore_drill_runs_within_sla ON restore_drill_runs (within_sla);
CREATE INDEX IF NOT EXISTS ix_restore_drill_runs_queue_job_id ON restore_drill_runs (queue_job_id);
CREATE INDEX IF NOT EXISTS ix_restore_drill_runs_config_created ON restore_drill_runs (config_id, created_at);
