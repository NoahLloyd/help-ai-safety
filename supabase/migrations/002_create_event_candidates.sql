-- Event Candidates: staging table for the event evaluation pipeline.
-- Raw scraped events land here before AI evaluation promotes them to `resources`.

create table if not exists event_candidates (
  id text primary key,

  -- Raw data from gatherer
  title text not null,
  description text,
  url text not null,
  raw_url text,
  source text not null,       -- "ea-forum" | "lesswrong" | "eventbrite" | "luma" | "meetup" | "submission"
  source_id text,             -- upstream ID for dedup
  source_org text,
  location text,
  event_date text,
  event_end_date text,
  submitted_by text,          -- only for source='submission'

  -- Scraped context (filled by evaluator)
  scraped_text text,

  -- AI evaluation results (filled by evaluator)
  ai_is_real_event boolean,
  ai_is_relevant boolean,
  ai_relevance_score real,
  ai_impact_score real,
  ai_suggested_ev real,
  ai_suggested_friction real,
  ai_event_type text,
  ai_summary text,
  ai_reasoning text,

  -- Pipeline status
  status text not null default 'pending',
  processed_at timestamptz,
  promoted_at timestamptz,
  promoted_resource_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-update updated_at
create trigger event_candidates_updated_at
  before update on event_candidates
  for each row
  execute function update_updated_at();

-- Indexes
create index idx_candidates_status on event_candidates(status);
create index idx_candidates_source on event_candidates(source, source_id);
create index idx_candidates_url on event_candidates(url);

-- RLS: public read for admin dashboard, service role write
alter table event_candidates enable row level security;

create policy "candidates_public_read" on event_candidates
  for select using (true);

-- Also ensure the resources table has the event_type column (used by the evaluator when promoting)
alter table resources add column if not exists event_type text;
