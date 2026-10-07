-- Anonymous visitors can evaluate their own (empty) entitlement when reading public videos.
create or replace function public.premium(uid uuid) returns boolean language sql stable security definer set search_path=public as $$ select (uid=auth.uid() or can('operations')) and exists(select 1 from subscriptions where user_id=uid and status='active' and expires_at>now()) $$;
grant execute on function public.premium(uuid) to anon;
create policy notifications_staff_read on notifications for select using(can('operations'));
