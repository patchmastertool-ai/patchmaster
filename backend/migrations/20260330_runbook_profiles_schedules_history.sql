CREATE TABLE IF NOT EXISTS runbook_profiles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'linux',
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    require_approval BOOLEAN NOT NULL DEFAULT FALSE,
    approval_role VARCHAR(30) NOT NULL DEFAULT 'operator',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(100) NOT NULL DEFAULT '',
    updated_by VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runbook_schedules (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES runbook_profiles(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL DEFAULT '0 2 * * *',
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    approved_by VARCHAR(100) NOT NULL DEFAULT '',
    approved_at TIMESTAMP NULL,
    next_run_at TIMESTAMP NULL,
    last_run_at TIMESTAMP NULL,
    created_by VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_runbook_schedules_profile_id ON runbook_schedules(profile_id);

CREATE TABLE IF NOT EXISTS runbook_executions (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER NULL REFERENCES runbook_profiles(id) ON DELETE SET NULL,
    schedule_id INTEGER NULL REFERENCES runbook_schedules(id) ON DELETE SET NULL,
    trigger_type VARCHAR(30) NOT NULL DEFAULT 'manual',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP NULL,
    initiated_by VARCHAR(100) NOT NULL DEFAULT '',
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    logs JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_runbook_executions_profile_id ON runbook_executions(profile_id);
CREATE INDEX IF NOT EXISTS ix_runbook_executions_schedule_id ON runbook_executions(schedule_id);
CREATE INDEX IF NOT EXISTS ix_runbook_executions_status ON runbook_executions(status);
