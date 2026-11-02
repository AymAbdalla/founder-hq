-- Slice 5: projects. Replaces the placeholder isolation table with the first real table.
drop table public.isolation_probe;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind text check (char_length(kind) <= 40),
  summary text check (char_length(summary) <= 200),
  notes text check (char_length(notes) <= 10000),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One name per account, ignoring case and surrounding spaces. Other accounts may reuse it.
create unique index projects_account_name_unique on public.projects (account_id, lower(btrim(name)));
create index projects_account_id_idx on public.projects (account_id);

-- Keeps updated_at current on every change.
create function public.set_updated_at() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- Row-level security: the database itself only shows an account its own rows,
-- and refuses writing a row into, or moving a row to, another account.
alter table public.projects enable row level security;

revoke all on public.projects from anon, public;
grant select, insert, update, delete on public.projects to authenticated;

create policy "own rows: read" on public.projects
  for select to authenticated using (account_id = (select auth.uid()));
create policy "own rows: add" on public.projects
  for insert to authenticated with check (account_id = (select auth.uid()));
create policy "own rows: change" on public.projects
  for update to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));
create policy "own rows: delete" on public.projects
  for delete to authenticated using (account_id = (select auth.uid()));

-- Not here yet: deleting a project and moving its items to the Inbox (spec P8).
-- Slice 6 adds items and that behavior.
