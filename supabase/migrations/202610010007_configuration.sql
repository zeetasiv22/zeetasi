create function public.configure_setting(p_key text,p_value jsonb,p_reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not can('operations') or length(trim(p_reason))<5 then raise exception 'Akses ditolak atau alasan kosong';end if;
 if p_key='ads' then if (p_value->>'frequency')::int not between 0 and 100 then raise exception 'Frekuensi tidak valid';end if;
 elsif p_key='gamification' then if (p_value->>'completion_xp')::int not between 0 and 100 then raise exception 'XP tidak valid';end if;
 elsif p_key='home' then if jsonb_typeof(p_value->'sections')<>'array' or jsonb_array_length(p_value->'sections')>20 then raise exception 'Bagian beranda tidak valid';end if;
 else raise exception 'Pengaturan tidak dikenal';end if;
 insert into application_settings(key,value) values(p_key,p_value) on conflict(key) do update set value=excluded.value;
 insert into admin_audit_logs(actor,target,action,reason,metadata) values(auth.uid(),p_key,'configure',p_reason,p_value);end $$;
create function public.configure_plan(p_id text,p_name text,p_price bigint,p_days int,p_enabled boolean,p_reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not can('entitlements') or length(trim(p_reason))<5 or p_price not between 1000 and 100000000 or p_days not between 1 and 1825 then raise exception 'Perubahan paket ditolak';end if;
 insert into subscription_plans values(p_id,p_name,p_price,p_days,p_enabled) on conflict(id) do update set name=excluded.name,price=excluded.price,days=excluded.days,enabled=excluded.enabled;
 insert into admin_audit_logs(actor,target,action,reason,metadata) values(auth.uid(),p_id,'configure-plan',p_reason,jsonb_build_object('price',p_price,'days',p_days,'enabled',p_enabled));end $$;
create function public.operational_metrics() returns jsonb language plpgsql stable security definer set search_path=public as $$ begin
 if not can('operations') then raise exception 'Akses ditolak';end if;
 return jsonb_build_object('accounts',(select count(*) from profiles),'new_accounts_30d',(select count(*) from profiles where created_at>now()-interval '30 days'),'active_viewers_24h',(select count(distinct user_id) from watch_progress where updated_at>now()-interval '24 hours'),'premium',(select count(distinct user_id) from subscriptions where status='active' and expires_at>now()),'verified_revenue',(select coalesce(sum(amount),0) from payment_events where status='settlement'),'completions',(select count(*) from episode_completions),'open_reports',(select count(*) from reports where status='open'),'failed_jobs',(select count(*) from background_jobs where status='failed'));end $$;
create function public.period_leaderboard(p_period text) returns table(username text,display_name text,xp bigint) language plpgsql stable security definer set search_path=public as $$ begin
 if p_period not in ('all','week','month') then raise exception 'Periode tidak valid';end if;
 if p_period='all' then return query select p.username,p.display_name,p.xp from profiles p where p.is_public and not p.suspended order by p.xp desc,p.username limit 50;
 else return query select p.username,p.display_name,greatest(0,sum(x.amount))::bigint from profiles p join xp_transactions x on x.user_id=p.id where p.is_public and not p.suspended and x.created_at>=date_trunc(p_period,now()) group by p.id order by sum(x.amount) desc,p.username limit 50;end if;end $$;
update application_settings set value='{"sections":[{"id":"trending","title":"Trending Sekarang","visible":true},{"id":"popular","title":"Anime Populer","visible":true},{"id":"genres","title":"Pilih Duniamu","visible":true},{"id":"continue","title":"Lanjutkan Petualanganmu","visible":true},{"id":"donghua","title":"Dunia Donghua","visible":true},{"id":"community","title":"Cerita seru, lebih seru dibahas.","visible":true}]}' where key='home';
-- Snapshot plan duration at order creation; later plan edits cannot change an existing payment.
alter table payment_events add column duration_days int check(duration_days>0);
create or replace function public.settle_payment(p_order text,p_status text,p_amount bigint) returns void language plpgsql security definer set search_path=public as $$ declare p payment_events; days int;starts timestamptz;begin
 select * into p from payment_events where order_id=p_order for update;if not found or p.amount<>p_amount then raise exception 'Transaksi tidak cocok';end if;
 if p.status in ('refund','chargeback') then return;end if;
 if p.status='settlement' and p_status not in ('refund','chargeback') then return;end if;
 update payment_events set status=p_status where id=p.id;
 if p_status='settlement' then
 perform 1 from profiles where id=p.user_id for update;
 select coalesce(p.duration_days,sp.days) into days from subscription_plans sp where id=p.plan_id;
 select greatest(now(),coalesce(max(expires_at),now())) into starts from subscriptions where user_id=p.user_id and status='active';
 insert into subscriptions(user_id,plan_id,expires_at,status,source,reference) values(p.user_id,p.plan_id,starts+make_interval(days=>days),'active','midtrans',p_order) on conflict(reference) do nothing;
 insert into notifications(user_id,title,body,event_key) values(p.user_id,'Premium aktif','Pembayaran Anda telah diverifikasi.','payment:'||p_order) on conflict do nothing;
 elsif p_status in ('refund','chargeback') then update subscriptions set status='revoked' where reference=p_order;end if;end $$;
