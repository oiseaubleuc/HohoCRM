#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  Orion — volledige PKG / DMG downloader (SaaS release-manifest)         ║
# ║  macOS: haalt manifest via API of URL, downloadt, verifieert SHA-256       ║
# ╚══════════════════════════════════════════════════════════════════════════╝
set -euo pipefail

usage() {
  cat <<'EOF' >&2
Gebruik:
  ORION_API_BASE=https://api.jouwdomein.com ./scripts/download-orion-pkg.sh [opties]
  ORION_MANIFEST_URL=https://…/orion-release-manifest.json ./scripts/download-orion-pkg.sh

Opties:
  -a URL    API-basis (default: env ORION_API_BASE of http://127.0.0.1:4000)
  -m URL    Manifest JSON direct (overschrijft API)
  -f PAD    Lokaal manifest-bestand
  -o PAD    Uitvoerbestand (default: ./Orion-v<VERSIE>.pkg in huidige map)
  -t pkg|dmg|nativeZip   Artefact (default: pkg)
  -i        Open installer na download (.pkg / .dmg)
  -n        Geen SHA-256 controle (niet aanbevolen)
  -q        Minder uitvoer
  -h        Deze hulp

Omgeving:
  ORION_API_BASE       bv. https://api.example.com
  ORION_MANIFEST_URL   directe URL naar orion-release-manifest.json
  ORION_MANIFEST_FILE  lokaal pad naar manifest
EOF
  exit 1
}

API_BASE="${ORION_API_BASE:-http://127.0.0.1:4000}"
MANIFEST_URL="${ORION_MANIFEST_URL:-}"
MANIFEST_FILE="${ORION_MANIFEST_FILE:-}"
OUT_PATH=""
ARTIFACT="pkg"
DO_INSTALL=0
SKIP_HASH=0
QUIET=0

while getopts "a:m:f:o:t:inqh" opt; do
  case "$opt" in
    a) API_BASE="$OPTARG" ;;
    m) MANIFEST_URL="$OPTARG" ;;
    f) MANIFEST_FILE="$OPTARG" ;;
    o) OUT_PATH="$OPTARG" ;;
    t) ARTIFACT="$OPTARG" ;;
    i) DO_INSTALL=1 ;;
    n) SKIP_HASH=1 ;;
    q) QUIET=1 ;;
    h|*) usage ;;
  esac
done

if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "⚠ Dit script is bedoeld voor macOS (installers zijn .pkg/.dmg)." >&2
fi

command -v curl >/dev/null || { echo "✗ curl ontbreekt" >&2; exit 1; }

TMP_JSON="$(mktemp)"
cleanup() { rm -f "$TMP_JSON"; }
trap cleanup EXIT

if [[ -n "$MANIFEST_FILE" ]]; then
  [[ -f "$MANIFEST_FILE" ]] || { echo "✗ Manifest niet gevonden: $MANIFEST_FILE" >&2; exit 1; }
  cp "$MANIFEST_FILE" "$TMP_JSON"
elif [[ -n "$MANIFEST_URL" ]]; then
  [[ "$QUIET" -eq 1 ]] || echo "▸ Manifest: $MANIFEST_URL"
  curl -fsSL "$MANIFEST_URL" -o "$TMP_JSON"
else
  [[ "$QUIET" -eq 1 ]] || echo "▸ Manifest API: $API_BASE/v1/releases/latest"
  curl -fsSL "$API_BASE/v1/releases/latest" -o "$TMP_JSON" || {
    echo "✗ Kon manifest niet laden. Zet ORION_MANIFEST_URL of start de API (backend)." >&2
    exit 1
  }
fi

# jq optioneel — anders rudimentaire grep/sed (fragiel); vereisen jq voor productie
if command -v jq >/dev/null; then
  URL=$(jq -r ".${ARTIFACT}.url // empty" "$TMP_JSON")
  SHA=$(jq -r ".${ARTIFACT}.sha256 // empty" "$TMP_JSON")
  FNAME=$(jq -r ".${ARTIFACT}.filename // empty" "$TMP_JSON")
  VER=$(jq -r '.version // empty' "$TMP_JSON")
else
  echo "✗ Installeer jq voor betrouwbare parsing: brew install jq" >&2
  exit 1
fi

if [[ -z "$URL" || "$URL" == "null" ]]; then
  echo "✗ Geen download-URL in manifest voor type '$ARTIFACT' (vul .url in orion-release-manifest.json)." >&2
  exit 1
fi

[[ -n "$FNAME" && "$FNAME" != "null" ]] || FNAME="Orion-download.${ARTIFACT}"
[[ -z "$OUT_PATH" ]] && OUT_PATH="./$FNAME"

[[ "$QUIET" -eq 1 ]] || echo "▸ Download: $URL"
[[ "$QUIET" -eq 1 ]] || echo "▸ Naar: $OUT_PATH"

curl -fL --progress-bar -o "$OUT_PATH" "$URL"

if [[ "$SKIP_HASH" -eq 0 && -n "$SHA" && "$SHA" != "null" ]]; then
  [[ "$QUIET" -eq 1 ]] || echo "▸ SHA-256 controleren…"
  echo "$SHA  $OUT_PATH" | shasum -a 256 -c - >/dev/null || {
    echo "✗ SHA-256 komt niet overeen — bestand verwijderd." >&2
    rm -f "$OUT_PATH"
    exit 1
  }
  [[ "$QUIET" -eq 1 ]] || echo "✓ Checksum OK"
elif [[ "$SKIP_HASH" -eq 0 ]]; then
  echo "⚠ Geen sha256 in manifest — overslaan (gebruik scripts/fill-release-manifest.sh na upload)." >&2
fi

echo "✓ Klaar: $OUT_PATH"
if [[ "$DO_INSTALL" -eq 1 ]]; then
  if [[ "$ARTIFACT" == "pkg" ]]; then
    open "$OUT_PATH"
  elif [[ "$ARTIFACT" == "dmg" ]]; then
    open "$OUT_PATH"
  else
    echo "ℹ Voor zip: uitpakken en .app naar Programma’s slepen." >&2
    open -R "$OUT_PATH"
  fi
fi
