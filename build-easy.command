#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
clear
printf "\nHohoCRM - Eenvoudige Builder\n"
printf "=================================\n"
printf "Kies wat je wil maken:\n\n"
printf "  1) Alleen webapp build (snel)\n"
printf "  2) Mac installer (.pkg + .dmg)\n"
printf "  3) Native Mac app (.app)\n"
printf "  4) Volledig pakket (alles)\n\n"
read -r -p "Jouw keuze (1-4): " CHOICE

case "$CHOICE" in
  1)
    cd "$ROOT/webapp"
    if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
    npm run build
    printf "\nKlaar. Webapp build staat in: webapp/dist\n"
    ;;
  2)
    "$ROOT/build.sh" all
    printf "\nKlaar. Installer bestanden staan in de root map (.pkg en .dmg).\n"
    ;;
  3)
    "$ROOT/build-native-mac-app.sh"
    printf "\nKlaar. Native app staat in de root map (.app).\n"
    ;;
  4)
    "$ROOT/build-full-package.sh"
    printf "\nKlaar. Volledig pakket staat in releases/.\n"
    ;;
  *)
    printf "\nOngeldige keuze. Start opnieuw en kies 1, 2, 3 of 4.\n"
    exit 1
    ;;
esac

printf "\nDruk op Enter om af te sluiten..."
read -r
