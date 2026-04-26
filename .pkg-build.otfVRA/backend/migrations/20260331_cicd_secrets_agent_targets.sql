-- CI/CD Secret Manager: encrypted key-value store scoped to pipeline or global
CREATE TABLE IF NOT EXISTS cicd_secrets (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    scope       VARCHAR(20)  NOT NULL DEFAULT 'global',  -- global | pipeline
    pipeline_id INTEGER REFERENCES cicd_pipelines(id) ON DELETE CASCADE,
    encrypted_value TEXT NOT NULL DEFAULT '',
    created_by  VARCHAR(100) NOT NULL DEFAULT '',
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cicd_secrets_name_scope_pipeline
    ON cicd_secrets (name, COALESCE(pipeline_id, 0));
CREATE INDEX IF NOT EXISTS ix_cicd_secrets_scope ON cicd_secrets (scope);
CREATE INDEX IF NOT EXISTS ix_cicd_secrets_pipeline_id ON cicd_secrets (pipeline_id);

-- CI/CD Agent Targets: map a pipeline environment to one or more agent hosts for CD execution
CREATE TABLE IF NOT EXISTS cicd_agent_targets (
    id              SERIAL PRIMARY KEY,
    pipeline_id     INTEGER NOT NULL REFERENCES cicd_pipelines(id) ON DELETE CASCADE,
    environment_id  INTEGER REFERENCES cicd_environments(id) ON DELETE SET NULL,
    host_id         INTEGER REFERENCES hosts(id) ON DELETE CASCADE,
    label           VARCHAR(200) NOT NULL DEFAULT '',
    run_as          VARCHAR(100) NOT NULL DEFAULT '',   -- user to run commands as (Linux sudo)
    working_dir     VARCHAR(500) NOT NULL DEFAULT '',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      VARCHAR(100) NOT NULL DEFAULT '',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_cicd_agent_targets_pipeline_id ON cicd_agent_targets (pipeline_id);
CREATE INDEX IF NOT EXISTS ix_cicd_agent_targets_host_id     ON cicd_agent_targets (host_id);

-- CI/CD Agent Runs: execution log for a CD step dispatched to an agent
CREATE TABLE IF NOT EXISTS cicd_agent_runs (
    id              SERIAL PRIMARY KEY,
    build_id        INTEGER NOT NULL REFERENCES cicd_builds(id) ON DELETE CASCADE,
    target_id       INTEGER REFERENCES cicd_agent_targets(id) ON DELETE SET NULL,
    host_id         INTEGER REFERENCES hosts(id) ON DELETE SET NULL,
    host_ip         VARCHAR(60) NOT NULL DEFAULT '',
    stage_name      VARCHAR(200) NOT NULL DEFAULT '',
    command         TEXT NOT NULL DEFAULT '',
    status          VARCHAR(30) NOT NULL DEFAULT 'pending',
    output          TEXT NOT NULL DEFAULT '',
    exit_code       INTEGER,
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_cicd_agent_runs_build_id  ON cicd_agent_runs (build_id);
CREATE INDEX IF NOT EXISTS ix_cicd_agent_runs_target_id ON cicd_agent_runs (target_id);
CREATE INDEX IF NOT EXISTS ix_cicd_agent_runs_status    ON cicd_agent_runs (status);
