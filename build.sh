#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║   HohohSolutions CRM — macOS .pkg Builder                      ║
# ║   Draai dit script op je Mac om de installer te bouwen          ║
# ║   Vereisten: macOS 11+, Xcode Command Line Tools                ║
# ╚══════════════════════════════════════════════════════════════════╝

set -e

# ── Kleuren ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; PURPLE='\033[0;35m'; NC='\033[0m'; BOLD='\033[1m'

echo ""
echo -e "${PURPLE}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${PURPLE}${BOLD}║   HohohSolutions CRM — .pkg Builder v1.0    ║${NC}"
echo -e "${PURPLE}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# ── Configuratie ──
APP_NAME="HohohSolutions CRM"
BUNDLE_ID="com.hohohsolutions.crm"
VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
PKG_OUTPUT="$SCRIPT_DIR/HohohSolutions-CRM-v${VERSION}.pkg"
DMG_OUTPUT="$SCRIPT_DIR/HohohSolutions-CRM-v${VERSION}.dmg"

NEED_PKG=0
NEED_DMG=0
case "${1:-pkg}" in
  pkg)  NEED_PKG=1 ;;
  dmg)  NEED_DMG=1 ;;
  all)  NEED_PKG=1; NEED_DMG=1 ;;
  *)
    echo -e "${RED}Onbekend argument: ${1}${NC}"
    echo -e "  ${YELLOW}./build.sh${NC}       → .pkg installer"
    echo -e "  ${YELLOW}./build.sh dmg${NC}   → .dmg (slepen naar Programma’s, geschikt voor M1/M2/M3)"
    echo -e "  ${YELLOW}./build.sh all${NC}   → .pkg én .dmg"
    exit 1
    ;;
esac

# ── Stap 1: Controleer macOS ──
echo -e "${BLUE}▸ Controleer macOS vereisten...${NC}"
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo -e "${RED}✗ Dit script vereist macOS. Huidig OS: $OSTYPE${NC}"
  exit 1
fi

MACOS_VER=$(sw_vers -productVersion | cut -d. -f1)
if [ "$MACOS_VER" -lt 11 ]; then
  echo -e "${YELLOW}⚠ macOS 11+ aanbevolen. Huidig: $(sw_vers -productVersion)${NC}"
fi
echo -e "${GREEN}✓ macOS $(sw_vers -productVersion)${NC}"

# ── Stap 2: Controleer tools ──
echo -e "${BLUE}▸ Controleer build tools...${NC}"
if [ "$NEED_PKG" -eq 1 ]; then
  for tool in pkgbuild productbuild; do
    if ! command -v $tool &> /dev/null; then
      echo -e "${RED}✗ '$tool' niet gevonden. Installeer Xcode Command Line Tools:${NC}"
      echo -e "  ${YELLOW}xcode-select --install${NC}"
      exit 1
    fi
    echo -e "${GREEN}✓ $tool${NC}"
  done
fi
if [ "$NEED_DMG" -eq 1 ]; then
  if ! command -v hdiutil &> /dev/null; then
    echo -e "${RED}✗ hdiutil niet gevonden (onverwacht op macOS).${NC}"
    exit 1
  fi
  echo -e "${GREEN}✓ hdiutil${NC}"
fi

# ── Stap 3: Webapp bouwen (Vite → dist/) ──
echo -e "${BLUE}▸ Webapp bouwen...${NC}"
WEBAPP_DIR="$SCRIPT_DIR/webapp"
if [ ! -f "$WEBAPP_DIR/package.json" ]; then
  echo -e "${RED}✗ webapp/package.json niet gevonden.${NC}"
  exit 1
fi
if ! command -v npm &> /dev/null; then
  echo -e "${RED}✗ npm niet gevonden. Installeer Node.js (https://nodejs.org) voor de webapp-build.${NC}"
  exit 1
fi
(
  cd "$WEBAPP_DIR" || exit 1
  if [ -f package-lock.json ]; then
    npm ci --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
  npm run build
)
if [ ! -f "$WEBAPP_DIR/dist/index.html" ]; then
  echo -e "${RED}✗ webapp/dist/index.html ontbreekt na build.${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Webapp build: $WEBAPP_DIR/dist${NC}"

# ── Stap 4: Build directories aanmaken ──
echo -e "${BLUE}▸ Build omgeving voorbereiden...${NC}"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/payload/Applications/${APP_NAME}.app/Contents/MacOS"
mkdir -p "$BUILD_DIR/payload/Applications/${APP_NAME}.app/Contents/Resources"
mkdir -p "$BUILD_DIR/scripts"
echo -e "${GREEN}✓ Build directories aangemaakt${NC}"

# ── Stap 5: App bundle samenstellen ──
echo -e "${BLUE}▸ App bundle samenstellen...${NC}"

APP_MACOS="$BUILD_DIR/payload/Applications/${APP_NAME}.app/Contents/MacOS"
APP_RES="$BUILD_DIR/payload/Applications/${APP_NAME}.app/Contents/Resources"

# Vite-dist naar app Resources
cp -R "$WEBAPP_DIR/dist/." "$APP_RES/"

# Info.plist kopiëren
cp "$SCRIPT_DIR/payload/Applications/${APP_NAME}.app/Contents/Info.plist" \
   "$BUILD_DIR/payload/Applications/${APP_NAME}.app/Contents/Info.plist"

# Launcher script kopiëren en uitvoerbaar maken
LAUNCHER="$BUILD_DIR/payload/Applications/${APP_NAME}.app/Contents/MacOS/${APP_NAME}"
cp "$SCRIPT_DIR/payload/Applications/${APP_NAME}.app/Contents/MacOS/${APP_NAME}" "$LAUNCHER"
chmod +x "$LAUNCHER"

echo -e "${GREEN}✓ App bundle klaar${NC}"

# ── Stap 6: Icoon genereren ──
echo -e "${BLUE}▸ App icoon genereren...${NC}"
if command -v python3 &> /dev/null; then
  # Probeer Pillow te installeren
  pip3 install Pillow --quiet 2>/dev/null || true
  python3 "$SCRIPT_DIR/generate_icon.py" "$APP_RES/AppIcon.icns" 2>/dev/null && \
    echo -e "${GREEN}✓ Icoon aangemaakt${NC}" || \
    echo -e "${YELLOW}⚠ Icoon kon niet worden aangemaakt (geen Pillow). Doorgaan zonder icoon...${NC}"
else
  echo -e "${YELLOW}⚠ Python3 niet gevonden. Doorgaan zonder icoon...${NC}"
fi

if [ "$NEED_PKG" -eq 1 ]; then

# ── Stap 7: Pre/post install scripts ──
echo -e "${BLUE}▸ Installer scripts schrijven...${NC}"

cat > "$BUILD_DIR/scripts/preinstall" << 'PREINSTALL'
#!/bin/bash
# Verwijder vorige installatie als die bestaat
if [ -d "/Applications/HohohSolutions CRM.app" ]; then
  rm -rf "/Applications/HohohSolutions CRM.app"
fi
exit 0
PREINSTALL

cat > "$BUILD_DIR/scripts/postinstall" << 'POSTINSTALL'
#!/bin/bash
# Maak launcher uitvoerbaar
chmod +x "/Applications/HohohSolutions CRM.app/Contents/MacOS/HohohSolutions CRM"

# Registreer met LaunchServices
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
  -f "/Applications/HohohSolutions CRM.app" 2>/dev/null || true

# Toon welkomstmelding
osascript -e 'display notification "HohohSolutions CRM is succesvol geïnstalleerd!" with title "Installatie voltooid" subtitle "Je vindt de app in /Applications" sound name "Glass"' 2>/dev/null || true

exit 0
POSTINSTALL

chmod +x "$BUILD_DIR/scripts/preinstall"
chmod +x "$BUILD_DIR/scripts/postinstall"
echo -e "${GREEN}✓ Scripts klaar${NC}"

# ── Stap 8: Component package bouwen ──
echo -e "${BLUE}▸ Component package bouwen...${NC}"
COMPONENT_PKG="$BUILD_DIR/component.pkg"

pkgbuild \
  --root "$BUILD_DIR/payload" \
  --scripts "$BUILD_DIR/scripts" \
  --identifier "$BUNDLE_ID" \
  --version "$VERSION" \
  --install-location "/" \
  "$COMPONENT_PKG"

echo -e "${GREEN}✓ Component package: $COMPONENT_PKG${NC}"

# ── Stap 9: Distribution XML aanmaken ──
echo -e "${BLUE}▸ Distribution configuratie schrijven...${NC}"
DIST_XML="$BUILD_DIR/distribution.xml"

cat > "$DIST_XML" << DISTXML
<?xml version="1.0" encoding="utf-8"?>
<installer-gui-script minSpecVersion="2">

  <title>HohohSolutions CRM</title>
  <organization>com.hohohsolutions</organization>
  <domains enable_localSystem="true" enable_currentUserHome="false"/>

  <welcome language="nl"
    mime-type="text/rtf"
    file="welcome.rtf"/>

  <readme language="nl"
    mime-type="text/plain"
    file="readme.txt"/>

  <license language="nl"
    mime-type="text/plain"
    file="license.txt"/>

  <options customize="never"
           require-scripts="true"
           allow-external-scripts="no"
           rootVolumeOnly="true"/>

  <volume-check>
    <allowed-os-versions>
      <os-version min="11.0"/>
    </allowed-os-versions>
  </volume-check>

  <choices-outline>
    <line choice="main"/>
  </choices-outline>

  <choice id="main"
          visible="false"
          title="HohohSolutions CRM"
          description="Installeert HohohSolutions CRM in /Applications">
    <pkg-ref id="$BUNDLE_ID"/>
  </choice>

  <pkg-ref id="$BUNDLE_ID"
           version="$VERSION"
           onConclusion="none">component.pkg</pkg-ref>
</installer-gui-script>
DISTXML

echo -e "${GREEN}✓ Distribution XML klaar${NC}"

# ── Stap 10: Installer resources (teksten) ──
echo -e "${BLUE}▸ Installer teksten schrijven...${NC}"
RESOURCES_DIR="$BUILD_DIR/installer_resources"
mkdir -p "$RESOURCES_DIR"

cat > "$RESOURCES_DIR/readme.txt" << 'README'
HohohSolutions CRM v1.0.0
═══════════════════════════

Professioneel freelance beheer platform voor Mac.

MODULES
• Dashboard met live statistieken
• Klantenbeheer (CRM)
• Projecten met architectuur, kanban & roadmap
• Facturen, voorschotten en creditnota's
• To-Do lijsten met subtaken
• Meeting notities & vergaderverslagen
• Gantt tijdlijn planning
• Agenda & afspraken
• API & Tools beheer

INSTALLATIE
De app wordt geïnstalleerd in /Applications.
Bij openen draait een kleine lokale webserver; de CRM opent in je browser op http://127.0.0.1
(zodat je gegevens correct bewaard blijven). Python 3 moet op de Mac aanwezig zijn.

DATA & PRIVACY
Alle data blijft 100% lokaal op jouw Mac.
Geen cloud, geen account, geen tracking.

BACKUP
Exporteer regelmatig via "Data → Exporteer JSON".
README

cat > "$RESOURCES_DIR/license.txt" << 'LICENSE'
HOHOHSOLUTIONS CRM — SOFTWARELICENTIE v1.0
Copyright (c) 2026 HohohSolutions. Alle rechten voorbehouden.

Gebruik is toegestaan voor persoonlijk en professioneel gebruik.
Doorverkopen of herdistribueren is niet toegestaan zonder schriftelijke toestemming.
De software wordt aangeboden zonder garantie.
LICENSE

# RTF welkomstbericht
cat > "$RESOURCES_DIR/welcome.rtf" << 'WELCOME'
{\rtf1\ansi\ansicpg1252
{\fonttbl\f0\fswiss\fcharset0 Helvetica;\f1\fswiss\fcharset0 Helvetica-Bold;}
{\colortbl;\red124\green106\blue247;\red38\green33\blue92;\red14\green14\blue16;}
\f1\fs36\cf2 Welkom bij HohohSolutions CRM\
\f0\fs22\cf0 \
\f0\fs20 Het professionele freelance beheer platform voor Mac.\
\
\f1\fs20\cf1 Wat je krijgt:\f0\cf0 \
\f0\fs18 \uc0\u8226  12 modules voor volledig freelance beheer\
\uc0\u8226  Klanten, projecten, facturen en planning\
\uc0\u8226  To-do lijsten en meeting notities\
\uc0\u8226  100% lokale data, geen cloud vereist\
\uc0\u8226  Werkt op Mac, iPad en iPhone\
\
Klik op \'c2\'bb Ga door \'ab om de installatie te starten.\
}
WELCOME

echo -e "${GREEN}✓ Installer teksten klaar${NC}"

# ── Stap 11: Finale .pkg bouwen ──
echo -e "${BLUE}▸ Finale installer bouwen...${NC}"
echo ""

productbuild \
  --distribution "$DIST_XML" \
  --resources "$RESOURCES_DIR" \
  --package-path "$BUILD_DIR" \
  "$PKG_OUTPUT"

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║  ✅  .pkg installer succesvol aangemaakt!        ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Output:${NC} $PKG_OUTPUT"
echo -e "${BOLD}Grootte:${NC} $(du -sh "$PKG_OUTPUT" | cut -f1)"
echo ""

fi

if [ "$NEED_DMG" -eq 1 ]; then
echo -e "${BLUE}▸ .dmg schijfimage bouwen...${NC}"
APP_BUILT="$BUILD_DIR/payload/Applications/${APP_NAME}.app"
rm -f "$DMG_OUTPUT"
hdiutil create -volname "$APP_NAME" -srcfolder "$APP_BUILT" -ov -format UDZO "$DMG_OUTPUT"
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║  ✅  .dmg succesvol aangemaakt!                  ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Output:${NC} $DMG_OUTPUT"
echo -e "${BOLD}Grootte:${NC} $(du -sh "$DMG_OUTPUT" | cut -f1)"
echo -e "${YELLOW}Tip:${NC} Dubbelklik de .dmg, sleep de app naar Programma’s. Werkt op Apple Silicon (M1/M2/M3) en Intel."
echo ""
fi

# ── Optioneel: Code signing ──
if [ "$NEED_PKG" -eq 1 ]; then
echo -e "${YELLOW}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  ⚠  Optioneel: Code signing voor Apple Notarisatie      ║${NC}"
echo -e "${YELLOW}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${YELLOW}║  Als je een Apple Developer ID hebt (99€/jaar):          ║${NC}"
echo -e "${YELLOW}║                                                          ║${NC}"
echo -e "${YELLOW}║  productsign --sign \"Developer ID Installer: JOUW NAAM\" ║${NC}"
echo -e "${YELLOW}║    HohohSolutions-CRM-v1.0.0.pkg                        ║${NC}"
echo -e "${YELLOW}║    HohohSolutions-CRM-v1.0.0-signed.pkg                 ║${NC}"
echo -e "${YELLOW}║                                                          ║${NC}"
echo -e "${YELLOW}║  Zonder signing: Gatekeeper toont een waarschuwing.      ║${NC}"
echo -e "${YELLOW}║  Gebruikers kunnen dit omzeilen via:                     ║${NC}"
echo -e "${YELLOW}║  Systeeminstellingen → Privacy & Beveiliging → Open     ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
fi

# ── Open output map ──
echo -e "${BLUE}▸ Output in Finder...${NC}"
if [ "$NEED_DMG" -eq 1 ] && [ "$NEED_PKG" -eq 0 ]; then
  open -R "$DMG_OUTPUT" 2>/dev/null || true
elif [ "$NEED_PKG" -eq 1 ] && [ "$NEED_DMG" -eq 0 ]; then
  open -R "$PKG_OUTPUT" 2>/dev/null || true
else
  [ "$NEED_PKG" -eq 1 ] && open -R "$PKG_OUTPUT" 2>/dev/null || true
  [ "$NEED_DMG" -eq 1 ] && open -R "$DMG_OUTPUT" 2>/dev/null || true
fi

echo -e "${BOLD}Klaar! 🎉${NC}"
echo ""
