#!/bin/bash
# Maakt een zip van de Mac-app en toont Sparkle sign_update-output voor je appcast.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VER="${1:?Gebruik: ./publish-mac-update.sh 1.0.1}"
shift

APP_SRC="$ROOT/Te-testen/HohohSolutions CRM.app"
if [ ! -d "$APP_SRC" ]; then
  echo "✗ $APP_SRC ontbreekt. Draai eerst: ./build-native-mac-app.sh"
  exit 1
fi

OUT_DIR="$ROOT/updates/dist"
mkdir -p "$OUT_DIR"
ZIP="$OUT_DIR/HohoCRM-${VER}.zip"
rm -f "$ZIP"

echo "▸ Zip maken: $ZIP"
ditto -c -k --sequesterRsrc --keepParent "$APP_SRC" "$ZIP"

SIGN_UPDATE="$(find "$ROOT/macos-native/.build/artifacts/sparkle" -name sign_update -type f 2>/dev/null | head -1)"
if [ -z "$SIGN_UPDATE" ]; then
  echo "⚠ sign_update niet gevonden. Draai eerst: cd macos-native && swift build -c release"
  echo "  Zip staat klaar: $ZIP"
  exit 0
fi

echo ""
echo "▸ Sparkle-handtekening (plak sparkle:edSignature en length in appcast):"
echo "   Optioneel: ./publish-mac-update.sh 1.0.1 --ed-key-file pad/naar/privaat.pem"
echo ""
"$SIGN_UPDATE" "$ZIP" "$@"

echo ""
echo "▸ Geüpload bestand: $ZIP"
echo "▸ Zet dezelfde URL in appcast als enclosure url= (HTTPS)."
