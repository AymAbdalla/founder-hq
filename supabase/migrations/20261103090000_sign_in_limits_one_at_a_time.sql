-- Sign-in limits, one decision at a time per address (security rule S5; independent check F1).
-- Before this, two requests for the same address at the same moment could both count the
-- earlier events, both see room, and both be recorded. Now each call first takes a lock for
-- that address and kind, held until its transaction ends, so the second call waits and then
-- counts the first one. Different addresses never wait on each other.
create or replace function public.allow_sign_in_event(p_kind text, p_email text)
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

  perform pg_advisory_xact_lock(hashtextextended('sign_in:' || p_kind || ':' || v_subject, 0));

  delete from private.sign_in_events where at < now() - interval '1 day';

  if p_kind = 'email_sent' then
    select count(*) filter (where at > clock_timestamp() - interval '60 seconds'), count(*)
      into v_last_minute, v_last_hour
      from private.sign_in_events
      where kind = 'email_sent' and subject = v_subject and at > clock_timestamp() - interval '1 hour';
    if v_last_minute >= 1 then return 'wait_minute'; end if;
    if v_last_hour >= 5 then return 'wait_hour'; end if;
  else
    select count(*) into v_recent_tries
      from private.sign_in_events
      where kind = 'code_attempt' and subject = v_subject and at > clock_timestamp() - interval '15 minutes';
    if v_recent_tries >= 5 then return 'wait_attempts'; end if;
  end if;

  insert into private.sign_in_events (kind, subject) values (p_kind, v_subject);
  return 'ok';
end;
$$;

-- Re-state who may call it, unchanged: only HQ's own server.
revoke all on function public.allow_sign_in_event(text, text) from public, anon, authenticated;
grant execute on function public.allow_sign_in_event(text, text) to service_role;
