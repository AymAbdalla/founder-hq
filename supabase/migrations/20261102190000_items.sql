-- Slice 6: items. Adds the items table (to-dos, reminders, ideas and features that belong to a
-- project or to the Inbox), the "waits on" links between items, a guard against items waiting
-- on each other in a loop, and a function that deletes a project and either keeps or deletes its items.

create table public.items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  kind text not null default 'todo' check (kind in ('todo', 'reminder', 'idea', 'feature')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  notes text check (char_length(notes) <= 10000),
  due_date date,
  due_time time,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A reminder must have a date. A time needs a date (the app fills in today when only a time is given).
  constraint items_reminder_needs_date check (kind <> 'reminder' or due_date is not null),
  constraint items_time_needs_date check (due_time is null or due_date is not null)
);

create index items_account_id_idx on public.items (account_id);
create index items_account_project_idx on public.items (account_id, project_id);
create index items_account_done_idx on public.items (account_id, done_at);

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- Row-level security, as for projects. An item may only point at a project the account can see,
-- which is the account's own (the project lookup is itself limited by the projects policies).
alter table public.items enable row level security;

revoke all on public.items from anon, public;
grant select, insert, update, delete on public.items to authenticated;

create policy "own rows: read" on public.items
  for select to authenticated using (account_id = (select auth.uid()));
create policy "own rows: add" on public.items
  for insert to authenticated
  with check (
    account_id = (select auth.uid())
    and (project_id is null or exists (select 1 from public.projects p where p.id = project_id))
  );
create policy "own rows: change" on public.items
  for update to authenticated
  using (account_id = (select auth.uid()))
  with check (
    account_id = (select auth.uid())
    and (project_id is null or exists (select 1 from public.projects p where p.id = project_id))
  );
create policy "own rows: delete" on public.items
  for delete to authenticated using (account_id = (select auth.uid()));

-- "item_id waits on waits_on_id". Deleting either item removes the link.
create table public.item_waits (
  item_id uuid not null references public.items (id) on delete cascade,
  waits_on_id uuid not null references public.items (id) on delete cascade,
  account_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, waits_on_id),
  check (item_id <> waits_on_id)
);

create index item_waits_waits_on_idx on public.item_waits (waits_on_id);
create index item_waits_account_idx on public.item_waits (account_id);

alter table public.item_waits enable row level security;

revoke all on public.item_waits from anon, public;
grant select, insert, delete on public.item_waits to authenticated;

create policy "own rows: read" on public.item_waits
  for select to authenticated using (account_id = (select auth.uid()));
create policy "own rows: delete" on public.item_waits
  for delete to authenticated using (account_id = (select auth.uid()));
-- Both items must be ones the account can see, so a link can never touch another account's item.
create policy "own rows: add" on public.item_waits
  for insert to authenticated
  with check (
    account_id = (select auth.uid())
    and exists (select 1 from public.items i where i.id = item_id)
    and exists (select 1 from public.items i where i.id = waits_on_id)
  );

-- Refuses a link that would make items wait on each other, directly or through other items.
create function public.refuse_waits_cycle() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if exists (
    with recursive chain (id) as (
      select w.waits_on_id from public.item_waits w where w.item_id = new.waits_on_id
      union
      select w.waits_on_id from public.item_waits w join chain c on w.item_id = c.id
    )
    select 1 from chain where id = new.item_id
  ) then
    raise exception using errcode = 'P0001', message = 'waits_cycle';
  end if;
  return new;
end;
$$;

create trigger item_waits_refuse_cycle
  before insert on public.item_waits
  for each row execute function public.refuse_waits_cycle();

-- Deletes a project. With keep_items the items stay and move to the Inbox (the project link is
-- cleared by the foreign key); without it they are deleted too. Runs as the caller, so it can
-- only touch the caller's own rows. Returns whether a project was deleted.
create function public.delete_project(target uuid, keep_items boolean) returns boolean
  language plpgsql
  set search_path = ''
as $$
declare
  removed integer;
begin
  if not keep_items then
    delete from public.items where project_id = target;
  end if;
  delete from public.projects where id = target;
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

revoke execute on function public.delete_project(uuid, boolean) from public, anon;
grant execute on function public.delete_project(uuid, boolean) to authenticated;
