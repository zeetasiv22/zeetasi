-- Only the backend writes provider responses. Signed sources are always temporary.
create table public.external_providers (
 id text primary key, health jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table public.external_titles (
 id text primary key, provider text not null, provider_id text not null, title text not null,
 genres jsonb not null default '[]', countries jsonb not null default '[]', metadata jsonb not null,
 updated_at timestamptz not null default now(), unique(provider,provider_id)
);
create table public.external_episodes (
 id text primary key, provider text not null, provider_id text not null, title_id text not null,
 metadata jsonb not null, updated_at timestamptz not null default now(), unique(provider,provider_id)
);
create table public.external_playback_sources (
 episode_ref text primary key, provider text not null, payload jsonb not null,
 expires_at timestamptz not null, updated_at timestamptz not null default now()
);
create table public.provider_cache (
 key text primary key, payload jsonb not null, expires_at timestamptz not null
);
create index provider_cache_expiry on public.provider_cache(expires_at);
create index external_playback_expiry on public.external_playback_sources(expires_at);
create table public.provider_quota (
 key text primary key, requests integer not null default 0, expires_at timestamptz not null
);
alter table public.external_providers enable row level security;
alter table public.external_titles enable row level security;
alter table public.external_episodes enable row level security;
alter table public.external_playback_sources enable row level security;
alter table public.provider_cache enable row level security;
alter table public.provider_quota enable row level security;
revoke all on public.external_providers, public.external_titles, public.external_episodes, public.external_playback_sources, public.provider_cache, public.provider_quota from anon, authenticated;
grant all on public.external_providers, public.external_titles, public.external_episodes, public.external_playback_sources, public.provider_cache, public.provider_quota to service_role;

-- Atomic shared quota for concurrent Vercel workers; callers cannot raise it from the browser.
create function public.reserve_provider_request(p_host text, p_monthly_limit integer default 1000)
returns boolean language plpgsql security definer set search_path=public as $$
declare n integer; minute_key text; month_key text; begin
 if p_host !~ '^[a-z0-9-]+\.p\.rapidapi\.com$' or p_monthly_limit < 1 or p_monthly_limit > 1000000 then raise exception 'Invalid quota'; end if;
 minute_key:=p_host||':'||to_char(now() at time zone 'UTC','YYYYMMDDHH24MI');
 month_key:=p_host||':'||to_char(now() at time zone 'UTC','YYYYMM');
 insert into provider_quota(key,requests,expires_at) values(month_key,1,date_trunc('month',now() at time zone 'UTC') at time zone 'UTC' + interval '1 month')
 on conflict(key) do update set requests=provider_quota.requests+1 where provider_quota.requests<p_monthly_limit returning requests into n;
 if n is null then return false; end if;
 n:=null;
 insert into provider_quota(key,requests,expires_at) values(minute_key,1,now()+interval '2 minutes')
 on conflict(key) do update set requests=provider_quota.requests+1 where provider_quota.requests<30 returning requests into n;
 delete from provider_quota where expires_at<now();
 delete from provider_cache where expires_at<now();
 delete from external_playback_sources where expires_at<now();
 return n is not null;
end $$;
revoke all on function public.reserve_provider_request(text,integer) from public,anon,authenticated;
grant execute on function public.reserve_provider_request(text,integer) to service_role;
