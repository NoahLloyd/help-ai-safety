-- Add source tracking fields for community sync
ALTER TABLE resources ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS source_id TEXT;

-- Index for fast re-matching during sync
CREATE INDEX IF NOT EXISTS idx_resources_source_id ON resources (source, source_id);
