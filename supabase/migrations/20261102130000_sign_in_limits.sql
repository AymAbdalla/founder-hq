-- Sign-in limits per email address (security rule S5).
-- One sign-in email per address per minute and five per hour; five code tries per 15 minutes.
-- Addresses are stored only as SHA-256 hashes, and events older than a day are removed.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.sign_in_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('email_sent', 'code_attempt')),
  subject text not null,
  at timestamptz not null default now()
);
create index sign_in_events_lookup on private.sign_in_events (kind, subject, at desc);

-- Returns 'ok' and records the event, or returns why it is refused (nothing recorded).
create function public.allow_sign_in_event(p_kind text, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject text := encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex');
  v_last_minute integer;
  v_last_hour integer;
  v_recent_tries integer;
begin
  if p_kind not in ('email_sent', 'code_attempt') then
    raise exception 'unknown sign-in event kind';
  end if;

  delete from private.sign_in_events where at < now() - interval '1 day';

  if p_kind = 'email_sent' then
    select count(*) filter (where at > now() - interval '60 seconds'), count(*)
      into v_last_minute, v_last_hour
      from private.sign_in_events
      where kind = 'email_sent' and subject = v_subject and at > now() - interval '1 hour';
    if v_last_minute >= 1 then return 'wait_minute'; end if;
    if v_last_hour >= 5 then return 'wait_hour'; end if;
  else
    select count(*) into v_recent_tries
      from private.sign_in_events
      where kind = 'code_attempt' and subject = v_subject and at > now() - interval '15 minutes';
    if v_recent_tries >= 5 then return 'wait_attempts'; end if;
  end if;

  insert into private.sign_in_events (kind, subject) values (p_kind, v_subject);
  return 'ok';
end;
$$;

revoke all on function public.allow_sign_in_event(text, text) from public;
grant execute on function public.allow_sign_in_event(text, text) to anon, authenticated;
