-- Migration: Simplified resource schema
-- Run this in the Supabase SQL Editor BEFORE re-seeding.

-- 0. Drop the old CHECK constraint on action_type values
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_action_type_check;

-- 1. Rename action_type → category
ALTER TABLE resources RENAME COLUMN action_type TO category;

-- 2. Add new columns
ALTER TABLE resources ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT 'Global';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE resources ADD COLUMN IF NOT EXISTS event_date TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE resources ADD COLUMN IF NOT EXISTS submitted_by TEXT;

-- 3. Rename active → enabled
ALTER TABLE resources RENAME COLUMN active TO enabled;

-- 4. Drop removed columns
ALTER TABLE resources DROP COLUMN IF EXISTS last_verified;
ALTER TABLE resources DROP COLUMN IF EXISTS social_proof;
ALTER TABLE resources DROP COLUMN IF EXISTS always_show;
ALTER TABLE resources DROP COLUMN IF EXISTS is_ongoing;
ALTER TABLE resources DROP COLUMN IF EXISTS has_deadline;
ALTER TABLE resources DROP COLUMN IF EXISTS geo_type;
ALTER TABLE resources DROP COLUMN IF EXISTS geo_value;

-- 5. Update category values from old action_type values
UPDATE resources SET category = 'other' WHERE category IS NULL OR category NOT IN ('events', 'programs', 'letters', 'communities', 'other');

-- Done! Now re-seed:  npx tsx scripts/seed.ts
