-- Add duplicate_of field for AI-powered cross-source deduplication.
-- When the evaluator detects a candidate is a duplicate of an existing event,
-- it stores the ID of the original event here.

alter table event_candidates add column if not exists duplicate_of text;
