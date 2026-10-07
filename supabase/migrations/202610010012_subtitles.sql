create table public.episode_subtitles (
 id uuid primary key default gen_random_uuid(),
 episode_id uuid not null references public.episodes(id) on delete cascade,
 language text not null check(language ~ '^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$' and length(language)<=35),
 label text not null check(length(trim(label)) between 1 and 60),
 url text not null check(length(url)<=2000 and url ~ '^(https://|/media/)'),
 license text not null check(length(trim(license)) between 5 and 1000),
 enabled boolean not null default true,
 unique(episode_id,language,label)
);
create index episode_subtitles_episode_idx on public.episode_subtitles(episode_id);
alter table public.episode_subtitles enable row level security;
-- Source visibility applies published-title and premium restrictions through existing source RLS.
create policy subtitles_read on public.episode_subtitles for select using (
 enabled and exists(select 1 from public.playback_sources s where s.episode_id=episode_subtitles.episode_id and s.enabled)
);
create policy subtitles_manage on public.episode_subtitles for all to authenticated using(public.can('catalog')) with check(public.can('catalog'));
grant select on public.episode_subtitles to anon;
grant select,insert,update,delete on public.episode_subtitles to authenticated;
grant all on public.episode_subtitles to service_role;
create or replace function public.manage_record(p_section text,p_record jsonb,p_reason text) returns void language plpgsql security invoker set search_path=public as $$
declare tbl text;permission text;cols text;updates text;begin
 if length(trim(p_reason))<5 then raise exception 'Alasan diperlukan';end if;
 select case p_section when 'catalog' then 'catalog_titles' when 'episodes' then 'episodes' when 'playback' then 'playback_sources' when 'subtitles' then 'episode_subtitles' when 'badges' then 'badge_definitions' when 'avatar-items' then 'avatar_items' when 'titles' then 'title_definitions' when 'announcements' then 'announcements' when 'ads' then 'ad_campaigns' end into tbl;
 if tbl is null then raise exception 'Modul tidak valid';end if;
 permission:=case when p_section in ('catalog','episodes','playback','subtitles') then 'catalog' else 'operations' end;
 if not can(permission) then raise exception 'Akses ditolak';end if;
 -- Whitelisted table names only. JSON is converted through the actual PostgreSQL row type.
 select string_agg(format('%I',key),','),string_agg(format('%I=excluded.%I',key,key),',') filter(where key<>'id') into cols,updates from jsonb_object_keys(p_record) key where key in (select column_name from information_schema.columns where table_schema='public' and table_name=tbl) and key<>'created_at';
 execute format('insert into %I (%s) select %s from jsonb_populate_record(null::%I,$1) on conflict(id) do update set %s',tbl,cols,cols,tbl,updates) using p_record;
 insert into admin_audit_logs(actor,target,action,reason,metadata) values(auth.uid(),p_record->>'id','save:'||p_section,p_reason,p_record);
end $$;
