-- Slice 3: phone notifications, first proof. Adds each device's notification sign-up, a queue
-- of test notifications, and the every-minute job that asks HQ's server to send what is due.

-- A device's notification sign-up (web push). It belongs to the account signed in on that
-- browser. Written only through register_push_subscription, which moves the sign-up to a new
-- account when another one signs in on the same browser (security rule S6).
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);
create index push_subscriptions_account_idx on public.push_subscriptions (account_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, public, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
create policy "own rows: read" on public.push_subscriptions
  for select to authenticated using (account_id = (select auth.uid()));
create policy "own rows: delete" on public.push_subscriptions
  for delete to authenticated using (account_id = (select auth.uid()));

create function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text) returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_account uuid := auth.uid();
begin
  if v_account is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  -- One browser, one owner: whoever signed in last on it.
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (account_id, endpoint, p256dh, auth)
    values (v_account, p_endpoint, p_p256dh, p_auth);
end;
$$;
revoke execute on function public.register_push_subscription(text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text) to authenticated;

-- Test notifications: "send me one in a minute". At most 3 waiting per account.
create table public.test_notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references auth.users (id) on delete cascade,
  due_at timestamptz not null,
  claimed_until timestamptz,
  attempts integer not null default 0,
  sent_at timestamptz,
  sent_count integer,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);
create index test_notifications_due_idx on public.test_notifications (due_at) where sent_at is null and failed_at is null;
create index test_notifications_account_idx on public.test_notifications (account_id);

alter table public.test_notifications enable row level security;
revoke all on public.test_notifications from anon, public, authenticated;
grant select on public.test_notifications to authenticated;
create policy "own rows: read" on public.test_notifications
  for select to authenticated using (account_id = (select auth.uid()));

create function public.schedule_test_notification() returns timestamptz
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_account uuid := auth.uid();
  v_due timestamptz := now() + interval '1 minute';
begin
  if v_account is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  -- One decision at a time per account, so two quick taps can't pass the limit together.
  perform pg_advisory_xact_lock(hashtextextended('test_notification:' || v_account::text, 0));
  if (select count(*) from public.test_notifications
      where account_id = v_account and sent_at is null and failed_at is null) >= 3 then
    raise exception 'too many waiting' using errcode = 'P0001';
  end if;
  insert into public.test_notifications (account_id, due_at, created_at) values (v_account, v_due, now());
  return v_due;
end;
$$;
revoke execute on function public.schedule_test_notification() from public, anon;
grant execute on function public.schedule_test_notification() to authenticated;

-- For HQ's server only: takes due test notifications off the queue for two minutes, so
-- overlapping runs never send the same one twice. After 3 tries one is marked failed.
create function public.claim_due_test_notifications(p_limit integer)
returns table (id uuid, account_id uuid)
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  update public.test_notifications t
     set failed_at = now()
   where t.sent_at is null and t.failed_at is null and t.attempts >= 3;
  return query
  update public.test_notifications t
     set claimed_until = now() + interval '2 minutes', attempts = t.attempts + 1
   where t.id in (
     select q.id from public.test_notifications q
      where q.due_at <= now() and q.sent_at is null and q.failed_at is null
        and (q.claimed_until is null or q.claimed_until < now())
      order by q.due_at
      limit greatest(1, least(p_limit, 100))
      for update skip locked)
  returning t.id, t.account_id;
end;
$$;
revoke execute on function public.claim_due_test_notifications(integer) from public, anon, authenticated;
grant execute on function public.claim_due_test_notifications(integer) to service_role;

-- The every-minute job (pg_cron). It posts to HQ's sending address with a shared secret.
-- Both come from the database's secret store (Supabase Vault), set per environment and never
-- written in this file; until they are set, the job does nothing.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function private.run_notification_job() returns void
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'hq_notify_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'hq_cron_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end;
$$;
revoke execute on function private.run_notification_job() from public;

select cron.schedule('hq-notifications', '* * * * *', 'select private.run_notification_job()');
