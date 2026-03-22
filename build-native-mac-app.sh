#!/bin/bash
# Construit l’app macOS native (Swift + WKWebView) avec la webapp intégrée.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="HohohSolutions CRM Native.app"
APP_OUT="$ROOT/$APP_NAME"

echo "▸ Webapp (Vite)..."
cd "$ROOT/webapp"
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
npm run build

echo "▸ Swift (Release)..."
cd "$ROOT/macos-native"
swift build -c release
BIN_DIR="$(swift build -c release --show-bin-path)"
EXE="$BIN_DIR/HohohSolutionsCRMNative"

echo "▸ Assemblage ${APP_NAME}..."
rm -rf "$APP_OUT"
mkdir -p "$APP_OUT/Contents/MacOS"
mkdir -p "$APP_OUT/Contents/Resources/webroot"
cp "$EXE" "$APP_OUT/Contents/MacOS/HohohSolutionsCRMNative"
chmod +x "$APP_OUT/Contents/MacOS/HohohSolutionsCRMNative"
cp "$ROOT/macos-native/Info.plist" "$APP_OUT/Contents/Info.plist"
printf 'APPL????' > "$APP_OUT/Contents/PkgInfo"
rsync -a --delete "$ROOT/webapp/dist/" "$APP_OUT/Contents/Resources/webroot/"

if command -v codesign &>/dev/null; then
  codesign --force --deep -s - "$APP_OUT" 2>/dev/null || true
fi

echo ""
echo "✅ Terminé : $APP_OUT"
echo "   Double-clic pour lancer (fenêtre native, sans Safari)."
du -sh "$APP_OUT" | awk '{print "   Taille : " $1}'
