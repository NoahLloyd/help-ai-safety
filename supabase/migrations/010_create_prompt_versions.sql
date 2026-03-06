-- Prompt versioning: store and track all LLM prompt iterations
-- Keys: 'recommend' (recommendation engine), 'extract' (profile extraction), 'search' (Perplexity search)

create table if not exists prompt_versions (
  id bigint generated always as identity primary key,
  prompt_key text not null,
  version integer not null,
  content text not null,
  model text,
  note text,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- Only one active version per prompt_key
create unique index idx_prompt_active
  on prompt_versions (prompt_key)
  where is_active = true;

create index idx_prompt_key_version
  on prompt_versions (prompt_key, version desc);

-- Public read for prompt loading, admin write via service role
alter table prompt_versions enable row level security;

create policy "prompt_versions_public_read" on prompt_versions
  for select using (true);

-- Add prompt_version tracking to api_usage (if column doesn't exist)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'api_usage' and column_name = 'prompt_version'
  ) then
    alter table api_usage add column prompt_version integer;
  end if;
end
$$;
