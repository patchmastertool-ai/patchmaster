ALTER TABLE cicd_environments
ADD COLUMN IF NOT EXISTS approval_sla_minutes INTEGER NOT NULL DEFAULT 60;

ALTER TABLE cicd_environments
ADD COLUMN IF NOT EXISTS escalation_after_minutes INTEGER NOT NULL DEFAULT 120;

ALTER TABLE cicd_environments
ADD COLUMN IF NOT EXISTS escalation_targets JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE cicd_deployments
ADD COLUMN IF NOT EXISTS approval_due_at TIMESTAMP NULL;

ALTER TABLE cicd_deployments
ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP NULL;

ALTER TABLE cicd_deployments
ADD COLUMN IF NOT EXISTS escalation_status VARCHAR(30) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS cicd_deployment_approval_events (
    id SERIAL PRIMARY KEY,
    deployment_id INTEGER NOT NULL REFERENCES cicd_deployments(id) ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL,
    actor VARCHAR(100) NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_cicd_deployment_approval_events_deployment_created
ON cicd_deployment_approval_events (deployment_id, created_at);
