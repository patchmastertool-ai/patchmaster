CREATE TABLE IF NOT EXISTS alert_tickets (
    id SERIAL PRIMARY KEY,
    alert_key VARCHAR(255) NOT NULL,
    alert_name VARCHAR(120) NOT NULL,
    instance VARCHAR(255) NOT NULL DEFAULT '',
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    external_ref VARCHAR(120) NOT NULL DEFAULT '',
    created_by VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_alert_tickets_alert_key ON alert_tickets (alert_key);
CREATE INDEX IF NOT EXISTS ix_alert_tickets_alert_name ON alert_tickets (alert_name);
CREATE INDEX IF NOT EXISTS ix_alert_tickets_instance ON alert_tickets (instance);
CREATE INDEX IF NOT EXISTS ix_alert_tickets_status ON alert_tickets (status);
CREATE INDEX IF NOT EXISTS ix_alert_tickets_created_at ON alert_tickets (created_at);

CREATE TABLE IF NOT EXISTS alert_actions (
    id SERIAL PRIMARY KEY,
    alert_key VARCHAR(255) NOT NULL,
    alert_name VARCHAR(120) NOT NULL,
    instance VARCHAR(255) NOT NULL DEFAULT '',
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    action_type VARCHAR(30) NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    snooze_until TIMESTAMP NULL,
    ticket_id INTEGER NULL REFERENCES alert_tickets(id) ON DELETE SET NULL,
    created_by VARCHAR(100) NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_alert_actions_alert_key ON alert_actions (alert_key);
CREATE INDEX IF NOT EXISTS ix_alert_actions_alert_name ON alert_actions (alert_name);
CREATE INDEX IF NOT EXISTS ix_alert_actions_instance ON alert_actions (instance);
CREATE INDEX IF NOT EXISTS ix_alert_actions_snooze_until ON alert_actions (snooze_until);
CREATE INDEX IF NOT EXISTS ix_alert_actions_ticket_id ON alert_actions (ticket_id);
CREATE INDEX IF NOT EXISTS ix_alert_actions_created_at ON alert_actions (created_at);
