#!/bin/sh
# Regenerates public/icon/*.png. Needs ImageMagick 7 (`magick`).
# The logo sits on a white tile so the dark dots stay visible on dark toolbars:
# Chrome has no per-theme toolbar icon, so one icon has to work on both.
set -eu
cd "$(dirname "$0")/.."
master=$(mktemp -t icon).png
magick -size 512x512 xc:none \
  -fill white -draw "roundrectangle 32,32 480,480 104,104" \
  -fill '#E15A29' -draw "path 'M 256,380 A 130,130 0 0 0 386,250 L 126,250 A 130,130 0 0 0 256,380 Z'" \
  -fill '#16161D' -draw "circle 169,163 198,163 circle 343,163 372,163 circle 256,149 285,149" \
  "$master"
for size in 16 32 48 128; do
  magick "$master" -resize "${size}x${size}" -strip "public/icon/$size.png"
done
rm -f "$master"
