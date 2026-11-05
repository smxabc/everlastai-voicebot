# CLAUDE.md — EverlastAI Voice Agent

## Zweck
AI Voice Interview Agent (Testaufgabe): **Vapi** führt strukturierte Erstgespräche mit
Bewerber:innen (SDR/Sales), ein Webhook erstellt via GPT-4o ein strukturiertes
Bewerberprotokoll (JSON) und benachrichtigt HR per **Slack Block Kit**.

## Tech-Stack
Node.js / TypeScript, Express, OpenAI (GPT-4o), Vapi (STT+LLM+TTS), Slack. tsx/tsc.

## Befehle
```bash
npm install
npm run dev        # tsx watch webhooks/server.ts
npm run build      # tsc
npm start          # node dist/webhooks/server.js
npm run typecheck  # tsc --noEmit
npm test           # tsx tests/validate.ts
```

## Architektur
- `webhooks/` — Express-Server, empfängt Vapi `end-of-call-report`
- `vapi/` — Vapi-Konfiguration/Assistant
- `architecture/`, `tests/`
- Deliverables: `PRESENTATION.md` (Hauptabgabe), `SETUP.md`, `CHEATSHEET.md`,
  `DEMO-RUNBOOK.md`, `SCHWACHSTELLENANALYSE.md`, `.pptx`/`.key`

## Env / Secrets (nur Namen — siehe `.env.example`)
OpenAI-API-Key, Vapi-Key, Slack-Token/Webhook.

## Status
Abgabe-/Demo-Projekt (Testaufgabe). Fokus auf Live-Demo + Präsentation.

> Diese Datei nach relevanten Änderungen aktualisieren statt duplizieren.
