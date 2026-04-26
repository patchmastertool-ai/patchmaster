-- Migration: Fix Bulk Job Unique Constraint
-- Date: April 14, 2026
-- Description: Change unique constraint from (name, created_at) to just (name)
--              to prevent duplicate bulk job names entirely

-- Drop old constraint
ALTER TABLE bulk_patch_jobs DROP CONSTRAINT IF EXISTS uq_bulk_patch_job_name_created_at;

-- Add new constraint on name only
ALTER TABLE bulk_patch_jobs ADD CONSTRAINT uq_bulk_patch_job_name UNIQUE (name);

-- Add comment
COMMENT ON CONSTRAINT uq_bulk_patch_job_name ON bulk_patch_jobs IS 'Ensures globally unique bulk job names';
