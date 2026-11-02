-- Placeholder table for the two-account isolation test (slice 2).
-- Slice 5 moves the isolation tests onto the real tables and drops this one.
create table public.isolation_probe (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  created_at timestamptz not null default now()
);

-- Row-level security: the database itself only shows an account its own rows.
alter table public.isolation_probe enable row level security;

revoke all on public.isolation_probe from anon, public;
grant select, insert, update, delete on public.isolation_probe to authenticated;

create policy "own rows: read" on public.isolation_probe
  for select to authenticated using (account_id = (select auth.uid()));
create policy "own rows: add" on public.isolation_probe
  for insert to authenticated with check (account_id = (select auth.uid()));
create policy "own rows: change" on public.isolation_probe
  for update to authenticated
  using (account_id = (select auth.uid()))
  with check (account_id = (select auth.uid()));
create policy "own rows: delete" on public.isolation_probe
  for delete to authenticated using (account_id = (select auth.uid()));
