create function public.manage_record(p_section text,p_record jsonb,p_reason text) returns void language plpgsql security invoker set search_path=public as $$
declare tbl text;permission text;cols text;updates text;begin
 if length(trim(p_reason))<5 then raise exception 'Alasan diperlukan';end if;
 select case p_section when 'catalog' then 'catalog_titles' when 'episodes' then 'episodes' when 'playback' then 'playback_sources' when 'badges' then 'badge_definitions' when 'avatar-items' then 'avatar_items' when 'titles' then 'title_definitions' when 'announcements' then 'announcements' when 'ads' then 'ad_campaigns' end into tbl;
 if tbl is null then raise exception 'Modul tidak valid';end if;
 permission:=case when p_section in ('catalog','episodes','playback') then 'catalog' else 'operations' end;
 if not can(permission) then raise exception 'Akses ditolak';end if;
 -- Whitelisted table names only. JSON is converted through the actual PostgreSQL row type.
 select string_agg(format('%I',key),','),string_agg(format('%I=excluded.%I',key,key),',') filter(where key<>'id') into cols,updates from jsonb_object_keys(p_record) key where key in (select column_name from information_schema.columns where table_schema='public' and table_name=tbl) and key<>'created_at';
 execute format('insert into %I (%s) select %s from jsonb_populate_record(null::%I,$1) on conflict(id) do update set %s',tbl,cols,cols,tbl,updates) using p_record;
 insert into admin_audit_logs(actor,target,action,reason,metadata) values(auth.uid(),p_record->>'id','save:'||p_section,p_reason,p_record);
end $$;
-- Administrative inserts are append-only and tied to the authenticated actor.
create policy audit_append on admin_audit_logs for insert with check(actor=auth.uid() and (can('catalog') or can('operations') or can('moderate')));
create function public.moderate_content(p_kind text,p_id uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$ begin
 if not can('moderate') or length(trim(p_reason))<5 then raise exception 'Akses ditolak atau alasan kosong';end if;
 if p_kind='comment' then update comments set removed=true where id=p_id;
 elsif p_kind='report' then update reports set status='resolved' where id=p_id;
 else raise exception 'Jenis tidak valid';end if;
 insert into admin_audit_logs(actor,target,action,reason) values(auth.uid(),p_id::text,'moderate:'||p_kind,p_reason);end $$;
-- Restrict high-volume owned collections and reports at the database boundary.
create function public.limit_owned_write() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if auth.uid() is not null then perform consume_limit(TG_TABLE_NAME,30,60);end if;return new;end $$;
create trigger limit_reports before insert on reports for each row execute function limit_owned_write();
create trigger limit_watchlist before insert on watchlist_items for each row execute function limit_owned_write();
create trigger limit_follows before insert on title_follows for each row execute function limit_owned_write();
create trigger limit_likes before insert on comment_likes for each row execute function limit_owned_write();
