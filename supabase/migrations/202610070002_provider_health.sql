-- Merge individual diagnostic results atomically across serverless instances.
create or replace function public.record_provider_health(p_provider text,p_health jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if length(p_provider) not between 1 and 50 or jsonb_typeof(p_health->'checks') is distinct from 'object' then raise exception 'Invalid health'; end if;
 insert into external_providers(id,health,updated_at) values(p_provider,p_health,now())
 on conflict(id) do update set
 health=jsonb_set(excluded.health,'{checks}',coalesce(external_providers.health->'checks','{}'::jsonb) || (excluded.health->'checks')),
 updated_at=now();
end $$;
revoke all on function public.record_provider_health(text,jsonb) from public,anon,authenticated;
grant execute on function public.record_provider_health(text,jsonb) to service_role;
