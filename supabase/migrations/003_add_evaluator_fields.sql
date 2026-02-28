-- Add new fields for enhanced AI evaluation output.

-- Event candidates: new AI output fields
alter table event_candidates add column if not exists ai_organization text;
alter table event_candidates add column if not exists ai_is_online boolean;
alter table event_candidates add column if not exists event_time text;

-- Resources: new fields for promoted events
alter table resources add column if not exists event_end_date text;
alter table resources add column if not exists event_time text;
alter table resources add column if not exists is_online boolean;
