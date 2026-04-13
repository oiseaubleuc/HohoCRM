#!/usr/bin/env bash
# Bouwt AppIcon.icns van een vierkante PNG (bijv. webapp/public/orion-logo.png) via sips + iconutil (macOS).
set -euo pipefail
SRC="${1:?Usage: icns_from_png.sh <source.png> <out.icns>}"
OUT="${2:?Usage: icns_from_png.sh <source.png> <out.icns>}"
if ! command -v sips >/dev/null || ! command -v iconutil >/dev/null; then
  echo "sips en iconutil zijn vereist (macOS)." >&2
  exit 1
fi
TMP="$(mktemp -d)"
ICONSET="$TMP/AppIcon.iconset"
mkdir "$ICONSET"
sips -z 16 16 "$SRC" --out "$ICONSET/icon_16x16.png" >/dev/null
sips -z 32 32 "$SRC" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$SRC" --out "$ICONSET/icon_32x32.png" >/dev/null
sips -z 64 64 "$SRC" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$SRC" --out "$ICONSET/icon_128x128.png" >/dev/null
sips -z 256 256 "$SRC" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$SRC" --out "$ICONSET/icon_256x256.png" >/dev/null
sips -z 512 512 "$SRC" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$SRC" --out "$ICONSET/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$SRC" --out "$ICONSET/icon_512x512@2x.png" >/dev/null
iconutil -c icns "$ICONSET" -o "$OUT"
rm -rf "$TMP"
echo "Icns geschreven: $OUT"
