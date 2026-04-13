# Orion — macOS native wrapper

Fenêtre **macOS native** : l’application **Orion** (by HohohSolutions) s’affiche dans un `WKWebView` intégré (pas de Safari/Chrome séparé). Un petit serveur HTTP local sert le contenu de `webapp/dist/` embarqué dans le bundle.

## Prérequis

- macOS 13+
- Xcode Command Line Tools (`swift`, `python3`)
- Dépendance Swift : **Sparkle** (téléchargée par SwiftPM sauf si `HOHOH_NO_SPARKLE=1`)

## Build

Depuis la racine du dépôt :

```bash
./scripts/build-native-mac-app.sh
```

Résultat : **`../artifacts/Orion Native.app`** (webapp `dist/` copiée dans `Contents/Resources/webroot/`).

Copie de test : **`artifacts/Te-testen/Orion.app`**.

## Structure

- `Sources/HohohSolutionsCRMNative/` — SwiftPM target (nom technique historique) : SwiftUI + Python HTTP + WebKit
- `Info.plist` — `CFBundleDisplayName` : **Orion** (exécutable : **OrionNative**)

## Mises à jour (Sparkle)

Voir `../updates/SPARKLE-UPDATES.md`.
