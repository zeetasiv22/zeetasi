-- Initial platform configuration for a new hosted Supabase project.
-- Apply AFTER all versioned migrations. Safe to repeat: preserves existing edits.
-- Review plan prices before enabling payments. No accounts, roles, transactions,
-- sample titles or playback sources are created by this script.

insert into subscription_plans values ('monthly','Bulanan',29000,30,true),('quarterly','3 Bulan',79000,90,true),('annual','Tahunan',249000,365,true) on conflict do nothing;
insert into avatar_items values ('orbit','Orbit','frame','#39F56B',0,false),('ice','Arctic','frame','#67D9FF',100,false),('premium','Neon Premium','frame','#AAFF57',0,true),('legend','Legenda','frame','#EBC96E',1000,false) on conflict do nothing;
insert into title_definitions values ('newcomer','Newcomer','#8A9690',0),('explorer','Explorer','#39F56B',100),('legend','Zeta Legend','#EBC96E',1000) on conflict do nothing;
insert into achievements values ('first-light','First Light','Selesaikan episode pertama.',1),('explorer','Penjelajah','Selesaikan 10 episode berbeda.',10) on conflict do nothing;
insert into badge_definitions values ('premium','Premium','#39F56B','check'),('moderator','Moderator','#EF5350','shield'),('owner','Owner','#EBC96E','crown') on conflict do nothing;
insert into application_settings values ('ads','{"frequency":2}'),('gamification','{"completion_xp":25}'),('home','{"sections":[{"id":"trending","title":"Trending Sekarang","visible":true},{"id":"popular","title":"Anime Populer","visible":true},{"id":"genres","title":"Pilih Duniamu","visible":true},{"id":"continue","title":"Lanjutkan Petualanganmu","visible":true},{"id":"donghua","title":"Dunia Donghua","visible":true},{"id":"community","title":"Cerita seru, lebih seru dibahas.","visible":true}]}') on conflict do nothing;
