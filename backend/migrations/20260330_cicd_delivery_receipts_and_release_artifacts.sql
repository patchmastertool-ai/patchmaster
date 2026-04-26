CREATE TABLE IF NOT EXISTS cicd_notification_delivery_receipts (
    id SERIAL PRIMARY KEY,
    deployment_id INTEGER NOT NULL REFERENCES cicd_deployments(id) ON DELETE CASCADE,
    event_type VARCHAR(40) NOT NULL,
    channel_type VARCHAR(40) NOT NULL,
    target VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    last_error TEXT NOT NULL DEFAULT '',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_cicd_delivery_receipt_deployment_event
ON cicd_notification_delivery_receipts (deployment_id, event_type);
CREATE INDEX IF NOT EXISTS ix_cicd_delivery_receipt_status_next_retry
ON cicd_notification_delivery_receipts (status, next_retry_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cicd_delivery_receipt_key
ON cicd_notification_delivery_receipts (deployment_id, event_type, channel_type, target);
