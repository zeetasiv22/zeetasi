create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users on delete cascade, username text not null unique check(username ~ '^[a-z0-9_]{3,24}$'), display_name text not null check(length(display_name) between 2 and 60), bio text not null default '' check(length(bio)<=300), avatar text not null default 'orbit', is_public boolean not null default false, activity_public boolean not null default false, suspended boolean not null default false, xp bigint not null default 0 check(xp>=0), created_at timestamptz not null default now()
);
create table public.user_roles(user_id uuid references profiles on delete cascade,role text check(role in ('contributor','moderator','admin','super_admin','owner')),primary key(user_id,role));
create table public.role_permissions(role text not null,permission text not null,primary key(role,permission));
insert into role_permissions values ('moderator','moderate'),('admin','moderate'),('admin','catalog'),('admin','entitlements'),('admin','operations'),('super_admin','moderate'),('super_admin','catalog'),('super_admin','entitlements'),('super_admin','operations'),('super_admin','roles'),('owner','moderate'),('owner','catalog'),('owner','entitlements'),('owner','operations'),('owner','roles'),('owner','ads.exempt');
create function public.active_user() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and not suspended) $$;
create function public.can(p text) returns boolean language sql stable security definer set search_path=public as $$ select active_user() and exists(select 1 from user_roles r join role_permissions pms on r.role=pms.role where r.user_id=auth.uid() and pms.permission=p) $$;
create table public.catalog_titles(id text primary key,title text not null,description text not null default '',poster text not null default '/placeholder.svg',banner text not null default '/placeholder.svg',year int,genres text[] not null default '{}',country text not null default '',published boolean not null default false,license text,created_at timestamptz not null default now());
create table public.title_external_ids(title_id text references catalog_titles on delete cascade,provider text not null,external_id text not null,primary key(provider,external_id),unique(title_id,provider));
create table public.genres(id bigint generated always as identity primary key,name text not null unique);
create table public.title_genres(title_id text references catalog_titles on delete cascade,genre_id bigint references genres on delete cascade,primary key(title_id,genre_id));
create table public.seasons(id uuid primary key default gen_random_uuid(),title_id text not null references catalog_titles on delete cascade,number int not null check(number>0),unique(title_id,number));
create table public.episodes(id uuid primary key default gen_random_uuid(),title_id text not null references catalog_titles on delete cascade,season_id uuid references seasons on delete set null,number int not null check(number>0),title text not null,duration int not null check(duration>0),published boolean not null default false,unique(title_id,number));
create table public.playback_sources(id uuid primary key default gen_random_uuid(),episode_id uuid not null references episodes on delete cascade,url text not null check(url ~ '^(https://|/media/)'),license text not null check(length(license)>4),type text not null default 'video/mp4' check(type in ('video/mp4','video/webm')),premium_only boolean not null default false,enabled boolean not null default true);
create table public.watchlists(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,name text not null default 'Daftar Saya',is_public boolean not null default false,unique(user_id,name));
create table public.watchlist_items(user_id uuid references profiles on delete cascade,title_id text not null,title text not null,poster text not null,folder text not null default 'Daftar Saya',created_at timestamptz not null default now(),primary key(user_id,title_id));
create table public.title_follows(user_id uuid references profiles on delete cascade,title_id text not null,created_at timestamptz not null default now(),primary key(user_id,title_id));
create table public.title_likes(user_id uuid references profiles on delete cascade,title_id text not null,primary key(user_id,title_id));
create table public.viewing_sessions(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,episode_id uuid not null references episodes on delete cascade,last_ping timestamptz not null default now(),credited_seconds numeric not null default 0,created_at timestamptz not null default now());
create table public.watch_progress(user_id uuid references profiles on delete cascade,episode_id uuid references episodes on delete cascade,position numeric not null default 0 check(position>=0),updated_at timestamptz not null default now(),primary key(user_id,episode_id));
create table public.episode_completions(user_id uuid references profiles on delete cascade,episode_id uuid references episodes on delete cascade,created_at timestamptz not null default now(),primary key(user_id,episode_id));
create table public.xp_transactions(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,amount int not null,reason text not null,event_key text not null unique,created_at timestamptz not null default now());
create table public.comments(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,target text not null check(length(target)<=100),body text not null check(length(body) between 2 and 2000),spoiler boolean not null default false,removed boolean not null default false,created_at timestamptz not null default now());
create index comments_target on comments(target,created_at desc);
create table public.comment_likes(user_id uuid references profiles on delete cascade,comment_id uuid references comments on delete cascade,primary key(user_id,comment_id));
create table public.reports(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,target text not null,reason text not null check(length(reason) between 5 and 2000),status text not null default 'open' check(status in ('open','resolved','dismissed')),created_at timestamptz not null default now());
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,title text not null,body text not null,category text not null default 'system',read_at timestamptz,event_key text not null unique,created_at timestamptz not null default now());
create index notifications_inbox on notifications(user_id,created_at desc);
create table public.notification_preferences(user_id uuid primary key references profiles on delete cascade,series boolean not null default true,community boolean not null default true,announcements boolean not null default false);
create table public.subscription_plans(id text primary key,name text not null,price bigint not null check(price>0),days int not null check(days>0),enabled boolean not null default true);
create table public.subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,plan_id text references subscription_plans,expires_at timestamptz not null,status text not null check(status in ('active','expired','revoked')),source text not null,reference text unique,created_at timestamptz not null default now());
create index subscription_user on subscriptions(user_id,expires_at);
create table public.payment_events(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,plan_id text not null references subscription_plans,order_id text not null unique,amount bigint not null,status text not null default 'pending',provider text not null default 'midtrans',created_at timestamptz not null default now());
create table public.avatar_items(id text primary key,name text not null,kind text not null check(kind in ('frame','avatar')),color text not null default '#39F56B',required_xp int not null default 0,premium boolean not null default false);
create table public.user_avatar_items(user_id uuid references profiles on delete cascade,item_id text references avatar_items on delete cascade,primary key(user_id,item_id));
create table public.user_avatar_equipment(user_id uuid primary key references profiles on delete cascade,frame_id text references avatar_items,avatar_id text references avatar_items);
create table public.title_definitions(id text primary key,name text not null,color text not null,required_xp int not null default 0);
create table public.user_titles(user_id uuid references profiles on delete cascade,title_id text references title_definitions on delete cascade,expires_at timestamptz,primary key(user_id,title_id));
create table public.badge_definitions(id text primary key,label text not null,color text not null,icon text not null);
create table public.achievements(id text primary key,name text not null,description text not null,required_completions int not null check(required_completions>0));
create table public.user_achievements(user_id uuid references profiles on delete cascade,achievement_id text references achievements on delete cascade,created_at timestamptz not null default now(),primary key(user_id,achievement_id));
create table public.announcements(id uuid primary key default gen_random_uuid(),title text not null,body text not null,published boolean not null default false,created_at timestamptz not null default now());
create table public.ad_campaigns(id uuid primary key default gen_random_uuid(),name text not null,image_url text not null,destination text not null check(destination like 'https://%'),starts_at timestamptz not null,ends_at timestamptz not null,enabled boolean not null default false,check(ends_at>starts_at));
create table public.ad_events(id uuid primary key default gen_random_uuid(),user_id uuid not null references profiles on delete cascade,episode_id uuid not null references episodes on delete cascade,campaign_id uuid references ad_campaigns on delete set null,status text not null default 'eligible' check(status in ('eligible','shown','unavailable','dismissed')),created_at timestamptz not null default now(),unique(user_id,episode_id));
create table public.application_settings(key text primary key,value jsonb not null);
create table public.admin_audit_logs(id uuid primary key default gen_random_uuid(),actor uuid references profiles on delete set null,target text not null,action text not null,reason text not null check(length(reason)>=5),metadata jsonb not null default '{}',created_at timestamptz not null default now());
create table public.integration_status(provider text primary key,status text not null,checked_at timestamptz not null default now(),message text);
create table public.background_jobs(id uuid primary key default gen_random_uuid(),kind text not null,status text not null,processed_at timestamptz not null default now(),details jsonb not null default '{}');
create table public.rate_limits(user_id uuid references profiles on delete cascade,action text,window_at timestamptz not null default now(),count int not null default 1,primary key(user_id,action));
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin
 insert into profiles(id,username,display_name) values(new.id,'zeta_'||replace(left(new.id::text,18),'-',''),'Penjelajah Zeta');
 insert into notification_preferences(user_id) values(new.id); insert into user_avatar_items(user_id,item_id) select new.id,id from avatar_items where required_xp=0 and not premium;
 return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
create function public.premium(uid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from subscriptions where user_id=uid and status='active' and expires_at>now()) $$;
create function public.consume_limit(kind text,maximum int,seconds int) returns void language plpgsql security definer set search_path=public as $$ declare n int; begin
 if not active_user() then raise exception 'Login diperlukan'; end if;
 insert into rate_limits(user_id,action) values(auth.uid(),kind) on conflict(user_id,action) do update set count=case when rate_limits.window_at<now()-make_interval(secs=>seconds) then 1 else rate_limits.count+1 end,window_at=case when rate_limits.window_at<now()-make_interval(secs=>seconds) then now() else rate_limits.window_at end returning count into n;
 if n>maximum then raise exception 'Terlalu banyak permintaan. Coba kembali nanti.'; end if; end $$;
create function public.update_profile(p_username text,p_name text,p_bio text,p_public boolean) returns void language plpgsql security definer set search_path=public as $$ begin
 perform consume_limit('profile',15,60);update profiles set username=p_username,display_name=p_name,bio=p_bio,is_public=p_public where id=auth.uid();end $$;
create function public.add_comment(p_target text,p_body text,p_spoiler boolean) returns void language plpgsql security definer set search_path=public as $$ begin
 perform consume_limit('comment',5,60);insert into comments(user_id,target,body,spoiler) values(auth.uid(),p_target,p_body,p_spoiler);end $$;
create function public.equip_avatar(item text) returns void language plpgsql security definer set search_path=public as $$ declare a avatar_items;begin
 perform consume_limit('avatar',20,60);select * into a from avatar_items where id=item;
 if not found or a.kind<>'frame' then raise exception 'Bingkai tidak ditemukan';end if;
 if not exists(select 1 from user_avatar_items where user_id=auth.uid() and item_id=item) and not exists(select 1 from profiles where id=auth.uid() and xp>=a.required_xp and (not a.premium or premium(auth.uid()))) then raise exception 'Item belum terbuka';end if;
 if a.premium and not premium(auth.uid()) then raise exception 'Premium diperlukan';end if;
 insert into user_avatar_items values(auth.uid(),item) on conflict do nothing;
 insert into user_avatar_equipment(user_id,frame_id) values(auth.uid(),item) on conflict(user_id) do update set frame_id=item;end $$;
create function public.start_viewing(eid uuid) returns uuid language plpgsql security definer set search_path=public as $$ declare sid uuid;begin
 perform consume_limit('viewing',10,60);
 if not exists(select 1 from episodes e join playback_sources p on p.episode_id=e.id where e.id=eid and e.published and p.enabled and (not p.premium_only or premium(auth.uid()))) then raise exception 'Video tidak tersedia';end if;
 delete from viewing_sessions where user_id=auth.uid();insert into viewing_sessions(user_id,episode_id) values(auth.uid(),eid) returning id into sid;return sid;end $$;
create function public.heartbeat(sid uuid,pos numeric) returns jsonb language plpgsql security definer set search_path=public as $$ declare s viewing_sessions; d int; credit numeric; inserted int; count_done int; frequency int; reward int;due boolean:=false;begin
 if not active_user() then raise exception 'Login diperlukan';end if;
 select * into s from viewing_sessions where id=sid and user_id=auth.uid() for update;if not found then raise exception 'Sesi berakhir';end if;
 select duration into d from episodes where id=s.episode_id;
 if pos<0 or pos>d+2 then raise exception 'Posisi tidak valid';end if;
 credit:=least(20,greatest(0,extract(epoch from now()-s.last_ping)));
 update viewing_sessions set credited_seconds=least(d,credited_seconds+credit),last_ping=now() where id=sid;
 insert into watch_progress values(auth.uid(),s.episode_id,least(d,pos),now()) on conflict(user_id,episode_id) do update set position=excluded.position,updated_at=now();
 if s.credited_seconds+credit>=d*0.9 and pos>=d*0.9 then
 insert into episode_completions(user_id,episode_id) values(auth.uid(),s.episode_id) on conflict do nothing;get diagnostics inserted=row_count;
 if inserted=1 then
 reward:=coalesce((select (value->>'completion_xp')::int from application_settings where key='gamification'),25);
 insert into xp_transactions(user_id,amount,reason,event_key) values(auth.uid(),reward,'Episode selesai','completion:'||auth.uid()||':'||s.episode_id);
 update profiles set xp=xp+reward where id=auth.uid();
 select count(*) into count_done from episode_completions where user_id=auth.uid();
 insert into user_achievements(user_id,achievement_id) select auth.uid(),id from achievements where required_completions<=count_done on conflict do nothing;
 frequency:=coalesce((select (value->>'frequency')::int from application_settings where key='ads'),2);
 due:=frequency>0 and count_done%frequency=0 and not premium(auth.uid()) and not can('ads.exempt');
 if due then insert into ad_events(user_id,episode_id) values(auth.uid(),s.episode_id) on conflict do nothing;end if;
 insert into notifications(user_id,title,body,event_key) values(auth.uid(),'Episode selesai','+'||reward||' XP ditambahkan.','completion:'||auth.uid()||':'||s.episode_id) on conflict do nothing;
 end if;end if;return jsonb_build_object('completed',exists(select 1 from episode_completions where user_id=auth.uid() and episode_id=s.episode_id),'ad_due',due);end $$;
create function public.staff_action(p_action text,p_target uuid,p_value text,p_reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 if length(trim(p_reason))<5 then raise exception 'Alasan diperlukan';end if;
 if p_action in ('grant_premium','revoke_premium') then
 if not can('entitlements') then raise exception 'Akses ditolak';end if;
 if p_action='grant_premium' then
 if p_value::timestamptz<=now() or p_value::timestamptz>now()+interval '5 years' then raise exception 'Tanggal kedaluwarsa tidak valid';end if;
 insert into subscriptions(user_id,expires_at,status,source) values(p_target,p_value::timestamptz,'active','manual');
 else update subscriptions set status='revoked' where user_id=p_target and status='active';end if;
 elsif p_action='role' then
 if not can('roles') or p_target=auth.uid() or exists(select 1 from user_roles where user_id=p_target and role='owner') or p_value not in ('user','contributor','moderator','admin') then raise exception 'Perubahan peran ditolak';end if;
 delete from user_roles where user_id=p_target;
 if p_value<>'user' then insert into user_roles values(p_target,p_value);end if;
 elsif p_action in ('suspend','restore') then
 if not can('roles') or p_target=auth.uid() or exists(select 1 from user_roles where user_id=p_target and role in ('owner','super_admin')) then raise exception 'Akses ditolak';end if;
 update profiles set suspended=(p_action='suspend') where id=p_target;
 elsif p_action='xp' then
 if not can('operations') or abs(p_value::int)>1000 then raise exception 'Akses ditolak';end if;
 insert into xp_transactions(user_id,amount,reason,event_key) values(p_target,p_value::int,p_reason,'admin:'||gen_random_uuid());update profiles set xp=greatest(0,xp+p_value::int) where id=p_target;
 else raise exception 'Aksi tidak dikenal';end if;
 insert into admin_audit_logs(actor,target,action,reason,metadata) values(auth.uid(),p_target::text,p_action,p_reason,jsonb_build_object('value',p_value));end $$;
create function public.settle_payment(p_order text,p_status text,p_amount bigint) returns void language plpgsql security definer set search_path=public as $$ declare p payment_events; days int;begin
 select * into p from payment_events where order_id=p_order for update;if not found or p.amount<>p_amount then raise exception 'Transaksi tidak cocok';end if;
 if p.status in ('refund','chargeback') then return;end if;
 if p.status='settlement' and p_status not in ('refund','chargeback') then return;end if;
 update payment_events set status=p_status where id=p.id;
 if p_status='settlement' then select sp.days into days from subscription_plans sp where id=p.plan_id;
 insert into subscriptions(user_id,plan_id,expires_at,status,source,reference) values(p.user_id,p.plan_id,now()+make_interval(days=>days),'active','midtrans',p_order) on conflict(reference) do nothing;
 insert into notifications(user_id,title,body,event_key) values(p.user_id,'Premium aktif','Pembayaran Anda telah diverifikasi.','payment:'||p_order) on conflict do nothing;
 elsif p_status in ('refund','chargeback') then update subscriptions set status='revoked' where reference=p_order;end if;end $$;
revoke all on function public.settle_payment(text,text,bigint) from public,anon,authenticated;
grant execute on function public.settle_payment(text,text,bigint) to service_role;
-- All tables default-deny. Policies below explicitly permit each boundary.
do $$ declare t record;begin for t in select tablename from pg_tables where schemaname='public' loop execute format('alter table public.%I enable row level security',t.tablename);end loop;end $$;
create policy profiles_read on profiles for select using(id=auth.uid() or is_public or can('operations'));
create policy roles_read on user_roles for select using(user_id=auth.uid() or can('roles'));
create policy role_permissions_read on role_permissions for select using(true);
create policy titles_read on catalog_titles for select using(published or can('catalog'));
create policy titles_manage on catalog_titles for all using(can('catalog')) with check(can('catalog'));
create policy episodes_read on episodes for select using(published or can('catalog'));
create policy episodes_manage on episodes for all using(can('catalog')) with check(can('catalog'));
create policy sources_read on playback_sources for select using((enabled and (not premium_only or premium(auth.uid())) and exists(select 1 from episodes where id=episode_id and published)) or can('catalog'));
create policy sources_manage on playback_sources for all using(can('catalog')) with check(can('catalog'));
do $$ declare tbl text;begin foreach tbl in array array['watchlists','watchlist_items','title_follows','title_likes','comment_likes','notification_preferences'] loop execute format('create policy own_data on %I for all using(user_id=auth.uid() and active_user()) with check(user_id=auth.uid() and active_user())',tbl);end loop;
foreach tbl in array array['watch_progress','viewing_sessions','episode_completions','xp_transactions','subscriptions','payment_events','user_avatar_items','user_avatar_equipment','user_titles','user_achievements','ad_events'] loop execute format('create policy own_read on %I for select using(user_id=auth.uid() or can(''operations''))',tbl);end loop;
foreach tbl in array array['genres','title_genres','title_external_ids','seasons','avatar_items','title_definitions','badge_definitions','achievements','subscription_plans'] loop execute format('create policy public_read on %I for select using(true)',tbl);execute format('create policy admin_manage on %I for all using(can(''operations'')) with check(can(''operations''))',tbl);end loop;end $$;
create policy history_delete on watch_progress for delete using(user_id=auth.uid() and active_user());
create policy comments_read on comments for select using(not removed or user_id=auth.uid() or can('moderate'));
create policy comments_delete on comments for delete using(user_id=auth.uid() and active_user());
create policy comments_moderate on comments for update using(can('moderate')) with check(can('moderate'));
create policy reports_create on reports for insert with check(user_id=auth.uid() and active_user());
create policy reports_read on reports for select using(user_id=auth.uid() or can('moderate'));
create policy reports_manage on reports for update using(can('moderate'));
create policy notifications_read on notifications for select using(user_id=auth.uid());
create policy notifications_update on notifications for update using(user_id=auth.uid()) with check(user_id=auth.uid());
revoke update on notifications from authenticated;grant update(read_at) on notifications to authenticated;
create policy announcements_read on announcements for select using(published or can('operations'));
create policy announcements_manage on announcements for all using(can('operations')) with check(can('operations'));
create policy campaigns_read on ad_campaigns for select using(enabled and starts_at<=now() and ends_at>now() or can('operations'));
create policy campaigns_manage on ad_campaigns for all using(can('operations')) with check(can('operations'));
create policy settings_read on application_settings for select using(true);
create policy settings_manage on application_settings for all using(can('operations')) with check(can('operations'));
create policy audit_read on admin_audit_logs for select using(can('operations'));
create policy integrations_read on integration_status for select using(can('operations'));
create policy jobs_read on background_jobs for select using(can('operations'));
-- No direct client writes to financial, XP, role, audit, progress or inventory tables.
revoke execute on function public.consume_limit(text,int,int) from public,anon,authenticated;
revoke execute on function public.handle_new_user() from public,anon,authenticated;
revoke execute on function public.premium(uuid) from public,anon;
grant execute on function public.premium(uuid) to authenticated;
