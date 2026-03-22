# Application macOS native (Swift + WKWebView)

Fenêtre **macOS authentique** : la CRM s’affiche dans un `WKWebView` intégré (pas de Safari/Chrome séparé).

## Prérequis

- macOS 13+
- **Xcode** ou **Command Line Tools** (`swift`, `swift build`)
- **Node.js** (pour la webapp)
- **Python 3** sur la machine cible (même mécanisme `http.server` sur `127.0.0.1` que le launcher shell — nécessaire pour `localStorage`)

## Build depuis la racine du dépôt

```bash
chmod +x build-native-mac-app.sh
./build-native-mac-app.sh
```

Résultat : **`HohohSolutions CRM Native.app`** à la racine (webapp `dist/` copiée dans `Contents/Resources/webroot/`).

## Code source

- `Sources/HohohSolutionsCRMNative/` — SwiftUI + serveur Python embarqué + WebKit
- `Info.plist` — copié dans le bundle `.app`

Pour compiler seulement le binaire :

```bash
cd macos-native && swift build -c release
```
