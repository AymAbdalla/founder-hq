-- Only HQ's own server may record or check sign-in limits (security rule S5).
-- Before this, anyone with the public key could call the function and use up
-- another address's sign-in emails without going through HQ's sign-in form.
revoke execute on function public.allow_sign_in_event(text, text) from anon, authenticated, public;
grant execute on function public.allow_sign_in_event(text, text) to service_role;
