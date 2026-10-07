#!/usr/bin/env bash
set -euo pipefail
mkdir -p public/media
ffmpeg -hide_banner -y -f lavfi -i 'color=c=0x050807:s=960x540:r=24:d=24' -vf "drawgrid=w=80:h=80:t=1:c=0x123c29,drawbox=x=100:y=160:w=760:h=220:color=0x0a2115:t=fill,drawtext=text='Z E T A   O R B I T':fontcolor=0x39F56B:fontsize=52:x=(w-tw)/2:y=(h-th)/2,drawtext=text='ORIGINAL MOTION STUDY  /  CC0':fontcolor=0x8A9690:fontsize=18:x=(w-tw)/2:y=330,drawtext=text='•':fontcolor=0x39F56B:fontsize=45:x=480+300*sin(t):y=240+180*cos(t),fade=t=in:st=0:d=2,fade=t=out:st=22:d=2" -c:v libvpx-vp9 -b:v 350k -pix_fmt yuv420p public/media/zeta-orbit.webm
