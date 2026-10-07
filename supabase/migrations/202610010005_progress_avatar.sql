alter table viewing_sessions add column last_position numeric not null default 0;
alter table profiles add column avatar_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',false,2097152,array['image/webp']) on conflict(id) do nothing;
create policy avatar_read on storage.objects for select using(bucket_id='avatars' and exists(select 1 from public.profiles where avatar_path=name and (id=auth.uid() or is_public)));
create function public.set_avatar(p_path text) returns void language plpgsql security definer set search_path=public as $$ begin
 perform consume_limit('avatar-upload',5,3600);if p_path not like auth.uid()::text||'/%' then raise exception 'Chemin invalide';end if;
 update profiles set avatar_path=p_path where id=auth.uid();end $$;
create function public.edit_comment(p_id uuid,p_body text,p_spoiler boolean) returns void language plpgsql security definer set search_path=public as $$ begin
 perform consume_limit('comment-edit',10,60);update comments set body=p_body,spoiler=p_spoiler where id=p_id and user_id=auth.uid() and not removed;end $$;
create function public.ad_delivery(p_event uuid,p_status text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not active_user() or p_status not in ('shown','unavailable','dismissed') then raise exception 'Invalid delivery';end if;
 update ad_events set status=p_status where id=p_event and user_id=auth.uid() and status='eligible';end $$;
create or replace function public.heartbeat(sid uuid,pos numeric) returns jsonb language plpgsql security definer set search_path=public as $$ declare s viewing_sessions; d int; credit numeric; inserted int; count_done int; frequency int; reward int;old_xp bigint;daily_xp int;campaign ad_campaigns;ad_id uuid;due boolean:=false;begin
 if not active_user() then raise exception 'Login diperlukan';end if;
 select * into s from viewing_sessions where id=sid and user_id=auth.uid() for update;if not found then raise exception 'Sesi berakhir';end if;
 select duration into d from episodes where id=s.episode_id;
 if pos<0 or pos>d+2 then raise exception 'Posisi tidak valid';end if;
 credit:=least(20,greatest(0,extract(epoch from now()-s.last_ping)),greatest(0,pos-s.last_position));
 update viewing_sessions set credited_seconds=least(d,credited_seconds+credit),last_ping=now(),last_position=pos where id=sid;
 insert into watch_progress values(auth.uid(),s.episode_id,least(d,pos),now()) on conflict(user_id,episode_id) do update set position=excluded.position,updated_at=now();
 if s.credited_seconds+credit>=d*0.9 and pos>=d*0.9 then
 insert into episode_completions(user_id,episode_id) values(auth.uid(),s.episode_id) on conflict do nothing;get diagnostics inserted=row_count;
 if inserted=1 then
 reward:=coalesce((select (value->>'completion_xp')::int from application_settings where key='gamification'),25);
 select xp into old_xp from profiles where id=auth.uid() for update;
 select coalesce(sum(amount),0) into daily_xp from xp_transactions where user_id=auth.uid() and created_at>=date_trunc('day',now()) and reason='Episode selesai';
 reward:=greatest(0,least(reward,500-daily_xp));
 insert into xp_transactions(user_id,amount,reason,event_key) values(auth.uid(),reward,'Episode selesai','completion:'||auth.uid()||':'||s.episode_id);
 update profiles set xp=xp+reward where id=auth.uid();
 insert into user_titles(user_id,title_id) select auth.uid(),id from title_definitions where required_xp<=old_xp+reward on conflict do nothing;
 if floor(sqrt((old_xp+reward)/100.0))>floor(sqrt(old_xp/100.0)) then insert into notifications(user_id,title,body,event_key) values(auth.uid(),'Level naik!','Cerita berikutnya menantimu.','level:'||auth.uid()||':'||(floor(sqrt((old_xp+reward)/100.0))+1)) on conflict do nothing;end if;
 select count(*) into count_done from episode_completions where user_id=auth.uid();
 insert into user_achievements(user_id,achievement_id) select auth.uid(),id from achievements where required_completions<=count_done on conflict do nothing;
 frequency:=coalesce((select (value->>'frequency')::int from application_settings where key='ads'),2);
 due:=frequency>0 and count_done%frequency=0 and not premium(auth.uid()) and not can('ads.exempt');
 if due then
 select * into campaign from ad_campaigns where enabled and starts_at<=now() and ends_at>now() order by starts_at desc limit 1;
 insert into ad_events(user_id,episode_id,campaign_id,status) values(auth.uid(),s.episode_id,campaign.id,case when campaign.id is null then 'unavailable' else 'eligible' end) on conflict do nothing returning id into ad_id;end if;
 insert into notifications(user_id,title,body,event_key) values(auth.uid(),'Episode selesai','+'||reward||' XP ditambahkan.','completion:'||auth.uid()||':'||s.episode_id) on conflict do nothing;
 end if;end if;return jsonb_build_object('completed',exists(select 1 from episode_completions where user_id=auth.uid() and episode_id=s.episode_id),'ad_due',due,'ad',case when campaign.id is not null and ad_id is not null then jsonb_build_object('eventId',ad_id,'name',campaign.name,'image',campaign.image_url,'destination',campaign.destination) else null end);end $$;
