create function public.notify_playable_episode() returns trigger language plpgsql security definer set search_path=public as $$
declare episode episodes;begin
 if not new.enabled then return new;end if;
 select * into episode from episodes where id=new.episode_id and published;
 if not found then return new;end if;
 insert into notifications(user_id,title,body,category,event_key)
 select f.user_id,'Episode baru tersedia',episode.title,'series','episode:'||episode.id||':'||f.user_id
 from title_follows f join notification_preferences p on p.user_id=f.user_id
 where f.title_id=episode.title_id and p.series
 on conflict(event_key) do nothing;
 return new;end $$;
create trigger source_notifications after insert or update of enabled on playback_sources for each row execute function notify_playable_episode();
create function public.notify_published_episode() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if new.published and not old.published then
 insert into notifications(user_id,title,body,category,event_key)
 select f.user_id,'Episode baru tersedia',new.title,'series','episode:'||new.id||':'||f.user_id
 from title_follows f join notification_preferences p on p.user_id=f.user_id
 where f.title_id=new.title_id and p.series and exists(select 1 from playback_sources where episode_id=new.id and enabled)
 on conflict(event_key) do nothing;end if;return new;end $$;
create trigger episode_notifications after update of published on episodes for each row execute function notify_published_episode();
revoke execute on function public.notify_playable_episode(),public.notify_published_episode() from public,anon,authenticated;
