-- Accounts may exist before the application's migrations are first installed.
-- Give them normal private profiles, never roles or paid entitlements.
do $backfill$
declare
  account record;
  candidate text;
  suffix int;
begin
  for account in select u.id from auth.users u
    where not exists(select 1 from public.profiles p where p.id=u.id)
  loop
    suffix := 0;
    candidate := 'zeta_' || left(replace(account.id::text,'-',''),19);
    while exists(select 1 from public.profiles where username=candidate) loop
      suffix := suffix+1;
      candidate := 'zeta_' || left(md5(account.id::text || ':' || suffix::text),19);
    end loop;
    insert into public.profiles(id,username,display_name)
      values(account.id,candidate,'Penjelajah Zeta');
  end loop;
  insert into public.notification_preferences(user_id)
    select id from public.profiles on conflict do nothing;
  insert into public.user_avatar_items(user_id,item_id)
    select p.id,a.id from public.profiles p cross join public.avatar_items a
    where a.required_xp=0 and not a.premium on conflict do nothing;
end $backfill$;
