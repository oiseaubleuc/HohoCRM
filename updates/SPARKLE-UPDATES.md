# Automatische updates (Sparkle) — HohohSolutions CRM Mac-app

De native app gebruikt **[Sparkle 2](https://sparkle-project.org/)**: op de achtergrond wordt je **appcast** (XML op **HTTPS**) geraadpleegd. Als er een nieuw zip-bestand staat met geldige handtekening, kan de gebruiker installeren vanuit de app (**HohohSolutions CRM → Controleren op updates…** of `⇧⌘U`).

## Eigen gebruik — jij maakt vaak updates

Eenmaal ingesteld is de **lus** steeds hetzelfde:

| Stap | Actie |
|------|--------|
| 1 | **`CFBundleVersion`** in `macos-native/Info.plist` verhogen (elke build +1; Sparkle vergelijkt dit getal). |
| 2 | Optioneel **`CFBundleShortVersionString`** aanpassen (bv. `1.0.2`). |
| 3 | `./build-native-mac-app.sh` |
| 4 | `./publish-mac-update.sh <zelfde-korte-versie>` → handtekening + `length` noteren. |
| 5 | Nieuwe `<item>` **bovenaan** in `appcast.xml` zetten, `url=` naar je geüploade zip, `sparkle:edSignature` en `length` invullen. |
| 6 | Zip + appcast uploaden naar je vaste HTTPS-map (zelfde basis-URL als `SUFeedURL`). |

**Tip:** zet `appcast.xml` in je repo (bv. `webapp/public/mac-updates/`) en laat Netlify die mee publiceren — dan hoef je alleen nog de zip te uploaden of ook in `public` te zetten en te pushen.

**Voor jezelf alleen:** notarisatie is niet verplicht; je kunt Gatekeeper-eventueel met Rechtsklik → Open omzeilen op je eigen Mac. Voor anderen die je app ooit krijgen, blijft notarisatie wel handig.

## 1. Eenmalig: sleutels genereren

Op je Mac (Terminal), na een build zodat de tools bestaan:

```bash
cd macos-native
swift build -c release
SPARKLE_BIN=$(find .build/artifacts/sparkle -name generate_keys -type f | head -1)
"$SPARKLE_BIN"
```

- De **private key** komt in je **Sleutelhanger** (aanbevolen) of gebruik `-f` voor een bestand — zie `generate_keys --help`.
- Kopieer de **public key** (Base64) naar `macos-native/Info.plist` bij **`SUPublicEDKey`** (vervang `VERVANG_MET_PUBLIC_KEY_VAN_generate_keys`).

## 2. Appcast-URL instellen

In `macos-native/Info.plist`:

- **`SUFeedURL`**: volledige HTTPS-URL naar je `appcast.xml`, bijvoorbeeld  
  `https://jouw-site.netlify.app/mac-updates/appcast.xml`

Host het bestand statisch (Netlify, GitHub Pages, S3, …). **Geen** `http://` in productie.

## 3. Nieuwe versie uitbrengen

1. Verhoog in `macos-native/Info.plist`:
   - `CFBundleShortVersionString` (bv. `1.0.1`)
   - `CFBundleVersion` (build-nummer, bv. `2` — moet **stijgen** t.o.v. vorige release)
2. Zelfde versies in het `<item>` van je appcast ( `sparkle:version` = build-nummer, `sparkle:shortVersionString` = korte versie).
3. Bouw de app:

   ```bash
   ./build-native-mac-app.sh
   ```

4. Maak een **zip** van de app (één `.app` in de zip):

   ```bash
   ./publish-mac-update.sh 1.0.1
   ```

   Het script toont **edSignature** en **length** voor het `<enclosure>`-element.

5. Upload `HohoCRM-1.0.1.zip` en de bijgewerkte `appcast.xml` naar dezelfde basis-URL als in `SUFeedURL`.

## 4. Notarisatie (optioneel, sterk aanbevolen voor klanten)

Zonder Apple-notarisatie kan Gatekeeper waarschuwen. Sparkle werkt het prettigst met een **Developer ID**-ondertekende app + notarisatie. Dat is los van deze repo; zie Apple-documentatie.

## 5. Web vs Mac

- **Netlify-webapp**: blijft los; updates via git push / Netlify-build.
- **Mac-app**: updates alleen via Sparkle + gehoste zip + appcast, zoals hierboven.
