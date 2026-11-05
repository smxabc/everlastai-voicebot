# SETUP – Accounts, Keys & Live-Demo (Schritt für Schritt)

Ziel: In ~1–2 Stunden von „nichts" zu einem **grünen Testcall**, der live in Slack landet.
Alle Dienste haben Gratis-Tiers — **Gesamtkosten für die Demo < 2 €**.

> Reihenfolge: erst alle Keys sammeln (Schritt 1–4), dann verdrahten (Schritt 5–8).

---

## Schritt 1 — OpenAI API-Key (für die Gesprächsauswertung)
1. https://platform.openai.com → einloggen / registrieren.
2. **Settings → Billing** → 5 $ aufladen (Pay-as-you-go). Tipp: **Usage Limit auf 5 $** setzen,
   dann kann nichts entgleisen.
3. **API Keys → Create new secret key** → kopieren.
4. → kommt später in `.env` als `OPENAI_API_KEY=sk-...`

Kosten: Eine Gesprächsauswertung mit GPT-4o kostet ~1–3 Cent.

---

## Schritt 2 — ElevenLabs (Stimme)
1. https://elevenlabs.io → registrieren. **Free-Tier** reicht (10.000 Zeichen/Monat ≈
   mehrere komplette Demo-Calls).
2. **Profile → API Key** kopieren (brauchst du nur, falls du ElevenLabs direkt statt über
   Vapi anbindest — bei Vapi-Integration trägst du den Key im Vapi-Dashboard ein).
3. Eine **deutsche Stimme** aussuchen (Voice Library → Filter „German"). Die `voiceId` aus
   der URL/Voice-Settings notieren → ersetzt den Platzhalter in `vapi/assistant-config.json`.

> Wenn dir das zu viel ist: Vapi hat ElevenLabs schon eingebaut — du wählst die Stimme
> einfach im Vapi-Dashboard-Dropdown. Dann brauchst du hier gar keinen eigenen Key.

---

## Schritt 3 — Slack (Ziel der Benachrichtigung)
1. Kostenlosen Workspace anlegen: https://slack.com/get-started (oder bestehenden nutzen).
2. Channel **#hr-candidates** erstellen.
3. **Incoming Webhook** anlegen:
   - https://api.slack.com/apps → **Create New App → From scratch** → Name „EverlastAI HR Bot",
     Workspace wählen.
   - Linkes Menü **Incoming Webhooks → Activate** (Toggle an).
   - **Add New Webhook to Workspace** → Channel `#hr-candidates` wählen → **Allow**.
   - Die **Webhook-URL** (`https://hooks.slack.com/services/...`) kopieren.
4. → kommt in `.env` als `SLACK_WEBHOOK_URL=...`

---

## Schritt 4 — Vapi (das Herzstück)
1. https://vapi.ai → registrieren. Es gibt **Gratis-Startguthaben** (~10 $).
2. **API Keys** notieren (Account-Menü) — falls du den Assistant per API statt im Dashboard
   anlegen willst.
3. **Assistant anlegen** (zwei Wege):
   - **Einfach (empfohlen):** Im Dashboard „Create Assistant" → leeres Template → dann die
     Werte aus `vapi/assistant-config.json` **manuell** in die Felder eintragen
     (Model, Voice, Transcriber, First Message, Advanced/Messaging). Den System-Prompt-Text
     aus `vapi/system-prompt.md` ins „System Prompt"-Feld kopieren.
   - **Per API:** `assistant-config.json` als Body an die Vapi-Create-Assistant-API schicken
     (Doku im Vapi-Dashboard). Schneller, aber Feldnamen ggf. an aktuelle Vapi-Version anpassen.
4. Stimme im Voice-Dropdown auf eine **deutsche ElevenLabs-Stimme** stellen.

---

## Schritt 5 — Projekt lokal starten
Im Terminal:
```bash
cd "/Users/schamilamarkhel/Desktop/EverlastAi voicebot"
cp .env.example .env        # dann .env öffnen und die 3 Keys eintragen
npm install
npm run dev                 # Webhook läuft auf http://localhost:3000
```
Test: Browser auf http://localhost:3000/health → muss `{"ok":true}` zeigen.

---

## Schritt 6 — Webhook öffentlich machen (ngrok)
Vapi muss deinen lokalen Server erreichen. ngrok legt einen öffentlichen Tunnel:
```bash
brew install ngrok          # falls noch nicht installiert
ngrok config add-authtoken <DEIN_NGROK_TOKEN>   # kostenlos auf ngrok.com holen
ngrok http 3000
```
ngrok zeigt eine URL wie `https://abc123.ngrok-free.app`. **Diese kopieren.**

> ⚠️ **Wichtig:** Die ngrok-URL **ändert sich bei jedem Neustart** (im Free-Tier). Wenn du
> ngrok neu startest, musst du die URL in Vapi neu eintragen. Am Demo-Tag ngrok **einmal**
> starten und laufen lassen.

---

## Schritt 7 — Vapi mit dem Webhook verbinden
Im Vapi-Assistant → **Advanced / Server Settings**:
- **Server URL:** `https://abc123.ngrok-free.app/vapi/events`
- **Server URL Secret:** denselben Wert wie `VAPI_SECRET` in deiner `.env`
- **Server Messages:** `end-of-call-report` aktivieren (plus `status-update`, `hang`).

---

## Schritt 8 — Erster Testcall
1. Im Vapi-Dashboard beim Assistant auf **„Talk to Assistant"** (Web-Call, Browser-Mikro)
   — **kein Telefonnummer-Setup nötig.**
2. Das Interview mit „Lena" durchführen (10 Min oder mit „danke, das war's" früher beenden).
3. Nach Call-Ende: **Slack #hr-candidates** checken → das Bewerberprotokoll mit Scores +
   Buttons muss erscheinen.
4. Im Terminal siehst du Logs (`[callId] processed → GO (8/10)`).

✅ Wenn das erscheint, ist die Demo **grün**.

---

## Troubleshooting
| Symptom | Ursache / Fix |
|---|---|
| Keine Slack-Nachricht | `SLACK_WEBHOOK_URL` falsch, oder Transkript < 200 Zeichen (zu kurzer Call) → länger sprechen |
| 401 im Vapi-Log | `VAPI_SECRET` in `.env` ≠ Server-Secret in Vapi → angleichen |
| Webhook kommt nicht an | ngrok-URL veraltet/Server aus → ngrok neu, URL in Vapi aktualisieren |
| OpenAI-Fehler | Key fehlt/kein Guthaben → Billing prüfen |
| Stimme klingt englisch | Transcriber `language: de` und deutsche ElevenLabs-Stimme prüfen |
| Agent fällt ins Wort | `endpointing` höher (z. B. 300–400ms), `stopSpeakingPlan.numWords` erhöhen |

---

## Kosten-Übersicht (Demo)
| Dienst | Kosten Demo |
|---|---|
| Vapi | aus Gratis-Guthaben (~10 $) |
| OpenAI (Auswertung) | ~1–3 Cent / Call |
| ElevenLabs | Free-Tier |
| Slack / ngrok | kostenlos |
| **Summe** | **deutlich unter 2 €** |
