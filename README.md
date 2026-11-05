# EverlastAI – Voice Interview Agent (Testaufgabe)

AI Voice Agent auf Basis von **Vapi**, der Erstgespräche mit Bewerber:innen (SDR/Sales-Rolle) führt, das Gespräch analysiert und den HR-Manager via **Slack** über den Outcome informiert.

## Architektur in einem Satz
**Vapi (STT + LLM + TTS)** → führt strukturiertes Interview → sendet `end-of-call-report` an unseren **Webhook (Node/Express)** → **GPT-4o** erstellt strukturiertes Bewerberprotokoll (JSON) → **Slack Block Kit** Nachricht an HR.

## Repo-Struktur
```
.
├── PRESENTATION.md           ← Hauptdeliverable: alle 7 Fragen + Recht/Ethik, Kosten, Build-vs-No-Code
├── SETUP.md                  ← Schritt-für-Schritt: Accounts, Keys, Live-Demo aufsetzen
├── CHEATSHEET.md             ← Spickzettel für den Call: Begründungen + GF-Fragen + Demo-Skript
├── EverlastAI_Voice_Agent.pptx ← Präsentations-Slides (17 Folien)
├── vapi/
│   ├── assistant-config.json ← Vapi Assistant Settings (kopierbar in Vapi Dashboard / API)
│   └── system-prompt.md      ← Interview-Prompt (mehrphasig, strukturiert)
├── webhooks/
│   ├── server.ts             ← Express-Server, empfängt Vapi end-of-call-report
│   ├── analyzer.ts           ← GPT-4o Auswertung → Bewerberprotokoll-JSON (Lazy-Init)
│   └── slack-notifier.ts     ← Slack Block Kit Nachricht an HR-Channel
├── tests/
│   └── validate.ts           ← 13 Laufzeit-Tests (Slack-Payload, HMAC, Edge-Cases)
├── architecture/
│   └── flow-diagram.md       ← Mermaid-Diagramm des End-to-End-Flows
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

## Quick Start (für Demo)
```bash
cp .env.example .env       # OPENAI_API_KEY, SLACK_WEBHOOK_URL, VAPI_SECRET eintragen
npm install
npm run typecheck          # TypeScript prüfen (muss grün sein)
npm test                   # 13 Validierungs-Tests (muss grün sein)
npm run dev                # startet Webhook auf :3000
ngrok http 3000            # Public URL → in Vapi serverUrl eintragen
```

Vollständige Anleitung inkl. Account-Erstellung: siehe **[SETUP.md](SETUP.md)**.
Vapi Assistant via Dashboard erstellen oder per API mit `vapi/assistant-config.json`.

## Status
- ✅ Code typgeprüft + 13 Tests grün, Server bootet & verarbeitet Webhooks (validiert)
- ✅ Präsentation (PRESENTATION.md) + Slides (17 Folien) + Spickzettel fertig
- ⏳ Echte Live-Demo: braucht eigene API-Keys (siehe SETUP.md) — dann End-to-End-Testcall

## Use Case
Generisches **Sales / SDR Erstgespräch-Screening** (~10-12 Min):
- Begrüßung & Vorstellung
- Motivation & Erfahrung im Vertrieb
- Cold-Call-Komfort / Outbound-Erfahrung
- Tool-Stack-Kenntnisse (CRM, Outreach, etc.)
- Gehaltsvorstellung & Verfügbarkeit
- Rückfragen Kandidat
- Abschluss

→ Bewertung in 6 Dimensionen, Empfehlung GO / MAYBE / NO-GO an HR.
