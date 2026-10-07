-- Optional editorial catalog import: actual complete CC BY 3.0 film, not a development fixture.
-- Verified license: https://peach.blender.org/about/ ; retain full ending credits.
-- Apply after versioned migrations; does not modify existing editorial records.
begin;
insert into catalog_titles(id,title,description,year,genres,country,published,license)
values ('big-buck-bunny','Big Buck Bunny','Film pendek animasi Blender Foundation (2008), edisi Sunflower, termasuk kredit penutup. © Blender Foundation | www.blender.org — CC BY 3.0. Lisensi: https://peach.blender.org/about/',2008,array['Animation','Short'],'NL',true,'© Blender Foundation | www.blender.org — CC BY 3.0') on conflict do nothing;
insert into episodes(id,title_id,number,title,duration,published) values ('00000000-0000-4000-8000-000000000003','big-buck-bunny',1,'Big Buck Bunny — Film Penuh',634,true) on conflict do nothing;
insert into playback_sources(id,episode_id,url,license,type,height) values ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003','https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.480p.vp9.webm','© Blender Foundation | www.blender.org — CC BY 3.0','video/webm',480) on conflict do nothing;
insert into playback_sources(id,episode_id,url,license,type,height) values ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000003','https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.360p.vp9.webm','© Blender Foundation | www.blender.org — CC BY 3.0','video/webm',360) on conflict do nothing;
commit;
