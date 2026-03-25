#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:-1.0.0}"
DATE_TAG="$(date +%Y%m%d-%H%M)"
REL_NAME="HohoCRM-FullPackage-v${VERSION}-${DATE_TAG}"
REL_DIR="$ROOT/releases/$REL_NAME"

APP_PKG="$ROOT/artifacts/HohohSolutions-CRM-v1.0.0.pkg"
APP_DMG="$ROOT/artifacts/HohohSolutions-CRM-v1.0.0.dmg"
NATIVE_APP="$ROOT/artifacts/HohohSolutions CRM Native.app"
WEB_DIST="$ROOT/webapp/dist"
VITRINE_HTML="$ROOT/marketing/hohohsolutions-website.html"

echo ""
echo "▸ Full package build starten..."
echo "  Output: $REL_DIR"

mkdir -p "$REL_DIR"
mkdir -p "$REL_DIR/installers"
mkdir -p "$REL_DIR/native"
mkdir -p "$REL_DIR/webapp"
mkdir -p "$REL_DIR/vitrine"

# 1) Webapp productiebuild
echo "▸ Webapp build..."
(
  cd "$ROOT/webapp"
  if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
  npm run build
)

if [ ! -f "$WEB_DIST/index.html" ]; then
  echo "✗ webapp/dist/index.html ontbreekt"
  exit 1
fi

# 2) Browser-based Mac app installers (.pkg + .dmg)
echo "▸ Installer build (.pkg + .dmg)..."
(
  cd "$ROOT"
  ./scripts/build.sh all
)

if [ ! -f "$APP_PKG" ] || [ ! -f "$APP_DMG" ]; then
  echo "✗ .pkg of .dmg ontbreekt na build.sh all"
  exit 1
fi

# 3) Native Mac app
echo "▸ Native app build..."
(
  cd "$ROOT"
  ./scripts/build-native-mac-app.sh
)

if [ ! -d "$NATIVE_APP" ]; then
  echo "✗ Native .app ontbreekt na build-native-mac-app.sh"
  exit 1
fi

# 4) Copy outputs
echo "▸ Release map vullen..."
cp "$APP_PKG" "$REL_DIR/installers/"
cp "$APP_DMG" "$REL_DIR/installers/"
rsync -a "$NATIVE_APP" "$REL_DIR/native/"
rsync -a "$WEB_DIST/" "$REL_DIR/webapp/"

if [ -f "$VITRINE_HTML" ]; then
  cp "$VITRINE_HTML" "$REL_DIR/vitrine/"
fi

# 5) Zip convenience bundles
(
  cd "$REL_DIR"
  ditto -c -k --sequesterRsrc --keepParent "native/HohohSolutions CRM Native.app" "installers/HohohSolutions-CRM-Native.app.zip" || true
  ditto -c -k --sequesterRsrc --keepParent "webapp" "webapp/HohoCRM-webapp-dist.zip" || true
)

# 6) Checksums
(
  cd "$REL_DIR"
  shasum -a 256 installers/* > SHA256SUMS.txt 2>/dev/null || true
  if [ -f "webapp/HohoCRM-webapp-dist.zip" ]; then
    shasum -a 256 "webapp/HohoCRM-webapp-dist.zip" >> SHA256SUMS.txt
  fi
  if [ -f "installers/HohoSolutions-CRM-Native.app.zip" ]; then
    shasum -a 256 "installers/HohoSolutions-CRM-Native.app.zip" >> SHA256SUMS.txt
  fi
)

# 7) Customer readme
cat > "$REL_DIR/README-CUSTOMER.txt" <<TXT
HohoCRM - Full Package v${VERSION}

Inhoud:
- installers/HohohSolutions-CRM-v1.0.0.pkg
- installers/HohohSolutions-CRM-v1.0.0.dmg
- native/HohohSolutions CRM Native.app
- webapp/  (deploybare webbuild)
- vitrine/ (vitrine website)
- SHA256SUMS.txt

Aanbevolen distributie:
1) Verkoopsite: host vitrine/hohohsolutions-website.html
2) Productplatform: deploy webapp/ op Netlify
3) Mac install: deel de .dmg of .pkg uit installers/ — dit installeert nu de echte Mac-app (eigen venster, geen Safari)
4) Optioneel: installers/HohoSolutions-CRM-Native.app.zip (zelfde techniek als in de .pkg)

Belangrijk:
- Vul Stripe links in de vitrine HTML voordat je verkoopt.
- Voor automatische follow-up e-mails: koppel een mailservice/API.
TXT

echo ""
echo "✅ Full package klaar"
echo "   $REL_DIR"
ls -la "$REL_DIR"
