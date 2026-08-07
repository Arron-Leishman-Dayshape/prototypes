/* First-party telemetry — run once in Supabase SQL Editor */
create table if not exists telemetry_events (
  id uuid primary key default gen_random_uuid(),
  prototype_id text not null,
  session_id text not null,
  event_type text not null,
  x numeric,
  y numeric,
  viewport_w integer,
  viewport_h integer,
  scroll_y numeric,
  scroll_max numeric,
  page_url text,
  page_path text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists telemetry_events_prototype_created_idx
  on telemetry_events (prototype_id, created_at desc);

create index if not exists telemetry_events_prototype_type_idx
  on telemetry_events (prototype_id, event_type);

create index if not exists telemetry_events_session_idx
  on telemetry_events (session_id, created_at);

alter table telemetry_events enable row level security;

drop policy if exists "Anyone can read telemetry" on telemetry_events;
drop policy if exists "Anyone can add telemetry" on telemetry_events;

create policy "Anyone can read telemetry" on telemetry_events for select using (true);
create policy "Anyone can add telemetry" on telemetry_events for insert with check (true);
