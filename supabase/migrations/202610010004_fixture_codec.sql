-- The supplied original fixture uses broadly supported VP9/WebM.
update playback_sources set url='/media/zeta-orbit.webm',type='video/webm' where url='/media/zeta-orbit.mp4' and license='ZetaHub original, CC0 1.0';
