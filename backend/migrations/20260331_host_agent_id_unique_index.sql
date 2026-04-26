-- Partial unique index on hosts.agent_id: prevents two rows with the same non-empty agent_id.
-- Allows multiple rows with agent_id='' (legacy hosts without an agent_id).
CREATE UNIQUE INDEX IF NOT EXISTS uq_hosts_agent_id_nonempty
    ON hosts (agent_id)
    WHERE agent_id IS NOT NULL AND agent_id != '';
