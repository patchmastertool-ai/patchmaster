CREATE TABLE IF NOT EXISTS patch_history_presets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    scope_type VARCHAR(20) NOT NULL DEFAULT 'user',
    role VARCHAR(20) NULL,
    user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_patch_history_presets_name ON patch_history_presets(name);
CREATE INDEX IF NOT EXISTS ix_patch_history_presets_scope_type ON patch_history_presets(scope_type);
CREATE INDEX IF NOT EXISTS ix_patch_history_presets_role ON patch_history_presets(role);
CREATE INDEX IF NOT EXISTS ix_patch_history_presets_user_id ON patch_history_presets(user_id);
