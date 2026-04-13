#!/usr/bin/env bash
# Vult sha256 + bytes (+ optioneel url) in webapp/public/releases/orion-release-manifest.json
# na een lokale build. Zonder BASE_URL blijven url-velden leeg tot je ze op CDN zet.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT/webapp/public/releases/orion-release-manifest.json"
PKG="$ROOT/artifacts/Orion-v1.0.0.pkg"
DMG="$ROOT/artifacts/Orion-v1.0.0.dmg"

command -v jq >/dev/null || { echo "Installeer: brew install jq"; exit 1; }
[[ -f "$MANIFEST" ]] || { echo "Ontbreekt: $MANIFEST"; exit 1; }

tmp="$(mktemp)"
cp "$MANIFEST" "$tmp"

update_block() {
  local key="$1" file="$2" base_url="${3:-}"
  [[ -f "$file" ]] || return 0
  local sha bytes fn url=""
  sha=$(shasum -a 256 "$file" | awk '{print $1}')
  bytes=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || wc -c <"$file")
  fn=$(basename "$file")
  [[ -n "$base_url" ]] && url="${base_url%/}/$fn"
  jq --arg k "$key" --arg sha "$sha" --argjson bytes "$bytes" --arg fn "$fn" --arg url "$url" \
    '.[$k] = (.[$k] // {}) + {filename: $fn, sha256: $sha, bytes: $bytes} + (if ($url | length) > 0 then {url: $url} else {} end)' \
    "$tmp" > "${tmp}.j" && mv "${tmp}.j" "$tmp"
}

BASE="${BASE_URL:-}"
update_block pkg "$PKG" "$BASE"
update_block dmg "$DMG" "$BASE"

ZIPFILE="$(ls -t "$ROOT/releases"/*/installers/Orion-Native.app.zip 2>/dev/null | head -1 || true)"
if [[ -n "$ZIPFILE" && -f "$ZIPFILE" ]]; then
  update_block nativeZip "$ZIPFILE" "$BASE"
fi

mv "$tmp" "$MANIFEST"
echo "✓ Bijgewerkt: $MANIFEST"
if [[ -z "$BASE" ]]; then
  echo "  Tip: BASE_URL=https://cdn.jouwdomein.com/orion/v1.0.0 $0"
fi
