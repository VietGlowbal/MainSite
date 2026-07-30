#!/usr/bin/env bash
#
# Regenerate the animated favicon from public/loading-globe.mp4.
#
# WHY THIS IS A SCRIPT AND NOT A ONE-LINER. Converting the clip naively gives a
# favicon that mostly sits still, and it is not obvious why. The source is NOT a
# continuous spin: it is spin, long pause, spin, long pause, spin, pause — three
# rotations separated by holds that take up most of its 9.4 seconds. Sampling
# evenly across the whole clip therefore lands mostly inside the holds, and any
# frames that do catch a rotation alias into a jerky mess.
#
# The rotation this extracts is source frames 11–50 — one complete revolution,
# measured by taking the per-pixel distance of every frame from frame 0 and
# finding where it returns to near-zero.
#
# WHY GIF. Firefox animates GIF favicons. Chrome, Edge and Safari support the
# format but not the animation, so they render frame 1 and sit still — which is
# the intended fallback, achieved with one file and no format negotiation. A
# canvas-based animator would spin everywhere, but at the cost of a per-frame
# redraw on every page for the rest of the session, and it stops working the
# moment the tab is backgrounded or JS fails.
#
# Requires ffmpeg. Run from the repository root:
#   ./scripts/build-favicon.sh
set -euo pipefail

SRC="public/loading-globe.mp4"
OUT_GIF="public/favicon.gif"
OUT_PNG="public/favicon.png"

command -v ffmpeg >/dev/null || { echo "ffmpeg is required"; exit 1; }
[ -f "$SRC" ] || { echo "missing $SRC"; exit 1; }

# The globe's bounding box inside the 360x360 frame, measured across several
# frames and stable to a pixel or two. The clip carries ~50px of padding on each
# side, which at 32x32 would throw away more than half the icon.
CROP="crop=252:252:53:48"

# One revolution, subsampled to every 2nd frame and replayed at 12fps, so the
# GIF turns once per ~1.7s — the same speed as the source.
SEGMENT="trim=start_frame=11:end_frame=51,setpts=PTS-STARTPTS,select='not(mod(n\,2))',setpts=N/(12*TB)"
SCALE="scale=32:32:flags=lanczos"
VF="$CROP,$SEGMENT,$SCALE"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Two-pass palette. stats_mode=diff weights the palette towards what moves,
# which matters here: the globe is a handful of teals over a near-white field,
# and a global palette spends its entries on the background instead.
ffmpeg -v error -i "$SRC" -vf "$VF,palettegen=stats_mode=diff:max_colors=64" -y "$TMP/palette.png"
ffmpeg -v error -i "$SRC" -i "$TMP/palette.png" \
  -lavfi "$VF[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4" \
  -loop 0 -y "$OUT_GIF"

# Frame 1 on its own, for anywhere a GIF is unwelcome.
ffmpeg -v error -i "$SRC" -vf "$CROP,select='eq(n\,11)',$SCALE" -frames:v 1 -y "$OUT_PNG"

printf 'favicon.gif  %s bytes, %s frames\n' \
  "$(stat -c%s "$OUT_GIF")" \
  "$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$OUT_GIF")"
printf 'favicon.png  %s bytes\n' "$(stat -c%s "$OUT_PNG")"
