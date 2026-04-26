ALTER TABLE cicd_environments
ADD COLUMN IF NOT EXISTS approval_quorum INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS cicd_deployment_approvals (
    id SERIAL PRIMARY KEY,
    deployment_id INTEGER NOT NULL REFERENCES cicd_deployments(id) ON DELETE CASCADE,
    approver VARCHAR(100) NOT NULL,
    decision VARCHAR(20) NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cicd_deployment_approval_deployment_user
ON cicd_deployment_approvals (deployment_id, approver);
CREATE INDEX IF NOT EXISTS ix_cicd_deployment_approval_deployment_decision
ON cicd_deployment_approvals (deployment_id, decision);

CREATE TABLE IF NOT EXISTS cicd_build_stage_runs (
    id SERIAL PRIMARY KEY,
    build_id INTEGER NOT NULL REFERENCES cicd_builds(id) ON DELETE CASCADE,
    stage_name VARCHAR(120) NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    duration_seconds INTEGER NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    output TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_cicd_stage_runs_build_order
ON cicd_build_stage_runs (build_id, order_index);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cicd_stage_runs_build_stage
ON cicd_build_stage_runs (build_id, stage_name);
