# Opvolgmail automatisch via Gmail (Netlify)

De CRM stuurt **geen** Gmail-wachtwoord mee vanuit de browser. Alleen een **Netlify Function** op jouw site mag met Gmail praten; jij zet daar de echte geheimen.

## 1. Gmail voorbereiden

1. Google-account: **[Beveiliging](https://myaccount.google.com/security)** → zet **2-stapsverificatie** aan.
2. Ga naar **App-wachtwoorden** (zoek in Google Account naar “App passwords”).
3. Maak een app-wachtwoord voor **Mail** / **Anders** → “Netlify CRM”.
4. Je krijgt een **16-teken code** (zonder spaties in de env var).

## 2. Netlify-omgevingsvariabelen

In **Netlify** → jouw site → **Site configuration** → **Environment variables** → voeg toe:

| Variabele | Voorbeeld / uitleg |
|-----------|-------------------|
| `GMAIL_USER` | `jouwadres@gmail.com` |
| `GMAIL_APP_PASSWORD` | de 16 tekens van het app-wachtwoord |
| `FOLLOWUP_API_SECRET` | een **lang willekeurig** geheim (zelf verzinnen, bv. 32+ tekens) |

**Belangrijk:** zelfde `FOLLOWUP_API_SECRET` gebruik je straks in de CRM (API & Tools).

Optioneel voor **ingebakken** defaults na elke deploy (dan hoef je URL/secret niet handmatig in de CRM te plakken):

| Variabele | Waar |
|-----------|------|
| `VITE_FOLLOWUP_URL` | `https://JOUW-SITE.netlify.app/.netlify/functions/send-followup` |
| `VITE_FOLLOWUP_SECRET` | **exact hetzelfde** als `FOLLOWUP_API_SECRET` |

Zet `VITE_*` ook onder **Build** environment (niet alleen Functions), anders zitten ze niet in de gebouwde webapp.

## 3. Deploy

Push naar GitHub; Netlify bouwt met `npm ci` (root) + webapp. De function staat op:

`https://<jouw-site>.netlify.app/.netlify/functions/send-followup`

## 4. In de CRM

1. Open **API & Tools**.
2. **Function URL** = de URL hierboven.
3. **API-geheim** = jouw `FOLLOWUP_API_SECRET`.
4. **Opslaan instellingen**.

Daarna: **Stuur opvolgmail** verstuurt **HTML-mail met voortgangsbalk** rechtstreeks via Gmail. Zonder deze instellingen blijft de oude **Mail-app** (mailto) werken.

## 5. Beveiliging (kort)

- Iedereen die jouw geheime URL + secret kent, kan vanaf het internet mails laten versturen **via jouw Gmail**. Houd het geheim strikt; overweeg later IP-beperking of een login.
- Zet **`Access-Control-Allow-Origin`** op Netlify eventueel op jouw exacte domein i.p.v. `*` (aanpassing in `send-followup.mjs`).
