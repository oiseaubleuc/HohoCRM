#!/bin/bash
# Construit l’app macOS native (Swift + WKWebView) avec la webapp intégrée.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="HohohSolutions CRM Native.app"
APP_OUT="$ROOT/$APP_NAME"

if [ "${HOHOH_SKIP_WEB_BUILD:-0}" = "1" ]; then
  echo "▸ Webapp (Vite)... overgeslagen (bestaande webapp/dist)"
  if [ ! -f "$ROOT/webapp/dist/index.html" ]; then
    echo "✗ webapp/dist/index.html ontbreekt — draai zonder HOHOH_SKIP_WEB_BUILD of voer npm run build uit"
    exit 1
  fi
else
  echo "▸ Webapp (Vite)..."
  cd "$ROOT/webapp"
  if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
  npm run build
fi

echo "▸ App icon..."
python3 "$ROOT/generate_icon.py" "$ROOT/macos-native/AppIcon.icns"

echo "▸ Swift (Release)..."
cd "$ROOT/macos-native"
swift build -c release
BIN_DIR="$(swift build -c release --show-bin-path)"
EXE="$BIN_DIR/HohohSolutionsCRMNative"

echo "▸ Assemblage ${APP_NAME}..."
rm -rf "$APP_OUT"
mkdir -p "$APP_OUT/Contents/MacOS"
mkdir -p "$APP_OUT/Contents/Frameworks"
mkdir -p "$APP_OUT/Contents/Resources/webroot"
cp "$EXE" "$APP_OUT/Contents/MacOS/HohohSolutionsCRMNative"
chmod +x "$APP_OUT/Contents/MacOS/HohohSolutionsCRMNative"

SPARKLE_FW="$(cd "$ROOT/macos-native" && swift build -c release --show-bin-path)/Sparkle.framework"
if [ -d "$SPARKLE_FW" ]; then
  echo "▸ Sparkle.framework inbundelen..."
  cp -R "$SPARKLE_FW" "$APP_OUT/Contents/Frameworks/"
  install_name_tool -add_rpath @executable_path/../Frameworks "$APP_OUT/Contents/MacOS/HohohSolutionsCRMNative" 2>/dev/null || true
else
  echo "⚠ Sparkle.framework niet gevonden — voer eerst: cd macos-native && swift build -c release"
fi

cp "$ROOT/macos-native/Info.plist" "$APP_OUT/Contents/Info.plist"
cp "$ROOT/macos-native/AppIcon.icns" "$APP_OUT/Contents/Resources/AppIcon.icns"
printf 'APPL????' > "$APP_OUT/Contents/PkgInfo"
rsync -a --delete "$ROOT/webapp/dist/" "$APP_OUT/Contents/Resources/webroot/"

if command -v codesign &>/dev/null; then
  if [ -d "$APP_OUT/Contents/Frameworks/Sparkle.framework" ]; then
    codesign --force --sign - "$APP_OUT/Contents/Frameworks/Sparkle.framework" 2>/dev/null || true
  fi
  codesign --force --deep -s - "$APP_OUT" 2>/dev/null || true
fi

TEST_OUT="$ROOT/Te-testen"
mkdir -p "$TEST_OUT"
rm -rf "$TEST_OUT/HohohSolutions CRM.app"
cp -R "$APP_OUT" "$TEST_OUT/HohohSolutions CRM.app"

echo ""
echo "✅ Terminé : $APP_OUT"
echo "   Double-clic pour lancer (fenêtre native, sans Safari)."
du -sh "$APP_OUT" | awk '{print "   Taille : " $1}'
