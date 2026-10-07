-- Resolution is declared only for measured, authorized renditions of the same full episode.
alter table public.playback_sources add column height integer check (height between 144 and 4320);
create index playback_sources_episode_enabled_idx on public.playback_sources(episode_id) where enabled;
