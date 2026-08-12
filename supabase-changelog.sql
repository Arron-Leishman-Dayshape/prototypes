/* Changelog / build-todo items per prototype — run once in Supabase SQL Editor */
create table if not exists changelog (
  id uuid primary key default gen_random_uuid(),
  prototype_id text not null,
  prototype_title text,
  title text not null,
  summary text not null default '',
  status text not null default 'todo',
  screenshot_data text,
  annotation jsonb default '{}'::jsonb,
  page_url text,
  page_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists changelog_prototype_created_idx
  on changelog (prototype_id, created_at desc);

create index if not exists changelog_prototype_status_idx
  on changelog (prototype_id, status);

alter table changelog enable row level security;

drop policy if exists "Anyone can read changelog" on changelog;
drop policy if exists "Anyone can add changelog" on changelog;
drop policy if exists "Anyone can update changelog" on changelog;
drop policy if exists "Anyone can delete changelog" on changelog;

create policy "Anyone can read changelog" on changelog for select using (true);
create policy "Anyone can add changelog" on changelog for insert with check (true);
create policy "Anyone can update changelog" on changelog for update using (true);
create policy "Anyone can delete changelog" on changelog for delete using (true);
