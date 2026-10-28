#!/usr/bin/env bash
# Монтаж рилса, три плана без повторов:
# 1) v1 0-3,5 с: сырой стейк ложится на сковороду;
# 2) mid.mp4 1,5 с: стейк уже перевёрнут полосами вверх, дым. Это хвост v2b с 4,6 с (до 4,55 с кончики щипцов ещё у верхнего края),
#    замедленный в 4,5 раза с интерполяцией (minterpolate), чтобы не было рывков;
# 3) v3 целиком: готовый стейк на доске, пар, текст с 5,6 с.
set -euo pipefail
ffmpeg -v error -y -ss 4.6 -t 0.44 -i v2b.mp4 -vf "setpts=4.5*PTS,minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:vsbmc=1" \
  -an -c:v libx264 -crf 16 mid.mp4
python3 -I text_png.py 720 1280
ffmpeg -v error -y -i v1.mp4 -i mid.mp4 -i v3.mp4 -i sizzle.mp3 -loop 1 -i t_720x1280.png -filter_complex "
[0:v]trim=0:3.5,setpts=PTS-STARTPTS,fps=24[a];[1:v]setpts=PTS-STARTPTS,fps=24[b];[2:v]trim=0:5.04,setpts=PTS-STARTPTS,fps=24[c];
[a][b][c]concat=n=3:v=1:a=0[v];[4:v]format=rgba,fade=t=in:st=5.6:d=0.4:alpha=1[t];[v][t]overlay=shortest=1,scale=540:-2,format=yuv420p[vo];
[3:a]atrim=0:10.04,afade=t=in:d=0.3,afade=t=out:st=9.1:d=0.94[au]" -map "[vo]" -map "[au]" -t 10.04 \
  -c:v libx264 -crf 27 -preset slow -movflags +faststart -c:a aac -b:a 96k reel.mp4
