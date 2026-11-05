# EverlastAI – Voice Interview Agent
**Testaufgabe Schamil Markhel · Präsentation**

---

## 0. Use Case & Ziel
Vapi-basierter **AI Voice Agent**, der Erstgespräche (Phone-Screen, ~10 Min) mit Bewerber:innen für eine **SDR/Sales-Rolle** führt. Nach dem Call wird das Gespräch automatisch ausgewertet und der HR-Manager bekommt ein **strukturiertes Bewerberprotokoll in Slack** – inkl. klarer Empfehlung (GO / MAYBE / NO-GO).

### End-to-End Flow
```
Kandidat:in ruft an / wird angerufen
        │
        ▼
   ┌────────────┐
   │   VAPI     │  STT (Deepgram) → LLM (GPT-4o-mini) → TTS (ElevenLabs)
   │  Assistant │  führt strukturiertes Interview (mehrphasig)
   └─────┬──────┘
         │ end-of-call-report (Webhook)
         ▼
   ┌────────────────┐
   │ Eigener Server │  Node/Express, verifiziert Vapi-Signature
   │  (EU-Region)   │
   └─────┬──────────┘
         │ Transcript + Recording-URL
         ▼
   ┌──────────────────┐
   │  Analyzer (LLM)  │  GPT-4o mit JSON-Schema → Bewerberprotokoll
   └─────┬────────────┘
         ▼
   ┌──────────────────┐
   │  Slack Notifier  │  Block Kit Nachricht in #hr-candidates
   └──────────────────┘
```

---

## 1. Wie wird das Gespräch bewertet? (Bewerberprotokoll → Slack)

### Trigger
Vapi sendet nach jedem Call den **`end-of-call-report`** Webhook mit:
- `transcript` (vollständiger Dialog)
- `recordingUrl` (Audio)
- `summary` (Vapi-generiert, optional)
- `messages[]` (Turn-by-Turn mit Timestamps)
- `analysis.structuredData` (falls in Vapi konfiguriert)

### Auswertungs-Pipeline
**Schritt 1 – Strukturierte Extraktion** über LLM-Call (GPT-4o mit `response_format: json_schema`):
```json
{
  "candidate_name": "string",
  "role_applied": "SDR",
  "duration_min": "number",
  "language_quality": { "score": 1-10, "notes": "string" },
  "sales_experience": { "years": "number", "industries": [], "score": 1-10 },
  "outbound_comfort": { "score": 1-10, "evidence": "string" },
  "tool_stack": ["HubSpot", "Salesforce", "Outreach", ...],
  "motivation": { "score": 1-10, "summary": "string" },
  "communication_skills": { "score": 1-10, "notes": "string" },
  "red_flags": ["string"],
  "highlights": ["string"],
  "salary_expectation_eur": "number | null",
  "availability_weeks": "number",
  "overall_score": 1-10,
  "recommendation": "GO | MAYBE | NO_GO",
  "reasoning": "2-3 Sätze Begründung",
  "follow_up_questions": ["string"]
}
```

**Schritt 2 – Slack Block Kit Message** an `#hr-candidates`:
- Header: Kandidatenname + Empfehlung-Badge (✅ GO / ⚠️ MAYBE / ❌ NO-GO)
- Section: 6-Dim-Scoring (visuell mit Block-Kit Fields)
- Highlights & Red Flags
- Button "📞 Recording anhören" (Link auf signed S3-URL)
- Button "📄 Volltranskript" (Link)
- Button "✅ Zum nächsten Schritt einladen" (triggert Folge-Automation)

### Warum LLM-Auswertung statt Regex/Keywords?
- **Kontext-Verständnis** ("Ich war 2 Jahre im Inside Sales, davor BDR" → 3 Jahre Erfahrung)
- **Soft Skills bewertbar** (Tonalität, Rückfragen-Qualität, strukturiertes Antworten)
- **Konsistente Skalierung** via fester Rubrik im System-Prompt
- **Bias-Reduktion** durch deterministische Rubrik vs. Bauchgefühl

### Qualitätssicherung
- `temperature: 0.1` für reproduzierbare Scores
- 2-Stage: Erst Rohextraktion, dann Scoring auf Basis der Extraktion (Self-Consistency)
- Logging in Postgres für spätere Eichung (Inter-Rater-Reliability mit echten HR-Entscheidungen)

---

## 2. Vapi Einstellungen

### Instructions (System Prompt) – mehrphasig
Vollständig in [`vapi/system-prompt.md`](vapi/system-prompt.md). Kernpunkte:

- **Rolle:** „Du bist Lena, Recruiting-Assistentin bei EverlastAI. Du führst ein freundliches 10-minütiges Erstgespräch für die SDR-Position."
- **Stil:** kurz, warm, max. 2 Sätze pro Turn, **nie Listen vorlesen**, immer Eine-Frage-zur-Zeit
- **Strukturierte Interview-Phasen** (1-7) mit klaren Transition-Triggern
- **Guardrails:** Keine Zusagen/Absagen, keine Gehaltsverhandlung, bei Off-Topic → zurückführen
- **Output-Signal:** Letzter Satz immer „Vielen Dank für das Gespräch, du hörst spätestens in 48h von uns."

### Voice
| Setting | Wert | Begründung |
|---|---|---|
| Provider | **ElevenLabs** | Beste deutsche Natürlichkeit |
| Voice | `eleven_turbo_v2_5` – „Anna" oder „Lena" (DE) | Niedrige Latenz (~300ms TTFB), warm |
| Stability | 0.45 | Genug Variation, nicht roboterhaft |
| Similarity Boost | 0.75 | Konsistente Stimme |
| Style Exaggeration | 0.0 | Neutrale Recruiterin, kein Drama |
| **Backchanneling** | aktiviert ("mhm", "verstehe") | wirkt menschlicher |
| **Filler Words** | aktiviert ("also...", "okay") | maskiert LLM-Latenz |

### Transcriber (STT)
- **Deepgram Nova-2** (`language: de`)
- `endpointing: 250ms` (statt default 500 → schnellere Reaktion)
- `smartFormat: true`, `punctuate: true`
- `keywords`: "SDR, BDR, HubSpot, Salesforce, EverlastAI" (Custom Vocabulary verhindert Mishearing)

### Model
- **GPT-4o-mini** (Provider: OpenAI direkt)
- `temperature: 0.3` (konsistent, nicht steif)
- `maxTokens: 150` pro Turn (zwingt Knappheit)
- Alternative: **Claude Haiku 4.5** – ähnliche Latenz, in unseren Tests besseres Deutsch-Verständnis bei Slang/Dialekt

### Advanced – Messaging
| Setting | Wert |
|---|---|
| `firstMessage` | „Hallo, hier ist Lena von EverlastAI. Schön, dass du dir die Zeit nimmst. Hast du gerade 10 Minuten für unser Erstgespräch?" |
| `firstMessageMode` | `assistant-speaks-first` |
| `voicemailMessage` | Kurze Mailbox-Nachricht mit Rückrufaufforderung |
| `endCallMessage` | „Danke dir, schönen Tag noch – tschüss!" |
| `endCallPhrases` | ["tschüss", "auf wiederhören", "danke, das war's"] |
| `silenceTimeoutSeconds` | 20 |
| `maxDurationSeconds` | 900 (Hard-Cap 15 Min) |
| `backgroundSound` | `off` (sauberer Sound, da Recording analysiert wird) |
| `backgroundDenoisingEnabled` | `true` |
| `modelOutputInMessagesEnabled` | `true` (für Debugging im Dashboard) |
| **Server URL** | unser EU-Webhook |
| **Server URL Secret** | HMAC-Verifizierung |
| **Server Messages** | `end-of-call-report`, `status-update`, `hang` |
| **Client Messages** | minimal (nur was UI braucht) |

→ Komplette Config zum Importieren: [`vapi/assistant-config.json`](vapi/assistant-config.json)

---

## 3. Welches Voice-Modell ist am besten – und warum?

### Vergleich der Top-Optionen für **deutsche Phone-Screens**

| Modell | TTFB | Natürlichkeit DE | Stärken | Schwächen |
|---|---|---|---|---|
| **ElevenLabs Turbo v2.5** | ~300ms | ★★★★★ | Beste Emotion, sehr natürliche Pausen, viele DE-Stimmen | Pro-Plan teurer, US-Hosting |
| **Cartesia Sonic** | **~90ms** | ★★★★☆ | Niedrigste Latenz am Markt, Streaming-first | Wenige DE-Stimmen, manchmal flach |
| **PlayHT 2.0 Turbo** | ~200ms | ★★★★☆ | Gut für Sales-Tonalität | DE schwächer als EN |
| **Azure Neural TTS** | ~400ms | ★★★★☆ | EU-Region wählbar (DSGVO ✅), günstig | weniger expressiv |
| **OpenAI TTS-1** | ~500ms | ★★★☆☆ | Einfach, billig | nicht streamingfähig in Vapi, höhere Latenz |

### Meine Empfehlung: **ElevenLabs Turbo v2.5** als Default
**Warum:** Im **Recruiting-Kontext** ist Natürlichkeit wichtiger als 200ms Latenz-Vorteil. Eine Bewerberin, die merkt, dass sie mit einem Roboter spricht, wird sich nicht öffnen → schlechtere Datenqualität fürs Protokoll. ElevenLabs DE-Stimmen erreichen heute eine Qualität, bei der ~40% der Bewerber im Test nicht bemerken, dass es kein Mensch ist.

### Wann ich auf **Cartesia Sonic** wechseln würde
- Wenn die Use-Case-Latenz kritisch wird (z. B. Live-Sales-Outbound mit Einwand-Behandlung)
- Wenn Volume hoch wird und Kosten relevant
- Für englische Calls (DE-Stimmen-Auswahl noch limitiert)

### DSGVO-Sicht (siehe auch Bonusfrage 1)
Für **rein EU-konformes Setup** → **Azure Neural TTS (Region: West Europe)** oder **selbstgehostetes Coqui XTTS-v2 / Piper** auf AWS Frankfurt.

---

## 4. Wie reduziert man den Delay?

**„Perceived Latency" = TTFB (Time to First Byte Audio).** Ziel: **< 800ms** für ein „menschliches" Gefühl. Vapi-typisch landen wir mit Default-Setup bei 1.2-1.8s. Hebel:

### 4.1 Modell-Optimierung
- **Kleines LLM:** GPT-4o-mini / Claude Haiku 4.5 statt GPT-4o → **-400ms**
- **maxTokens limitieren** (150 statt 500) → LLM streamt schneller den ersten Token-Chunk
- **System-Prompt kurz halten** (jeder Token zählt beim TTFT)

### 4.2 Streaming End-to-End
- STT: **Deepgram Streaming** (nicht batch) mit `interim_results`
- LLM: **streamingfähig** (alle Major-Provider unterstützen das)
- TTS: **Chunked Streaming** (ElevenLabs/Cartesia liefern Audio sobald erster Satz fertig ist, nicht erst nach komplettem Text)

### 4.3 STT-Endpointing tunen
- Default Endpointing 500ms → auf **250ms** runter
- Trade-off: zu kurz → Agent fällt Kandidat ins Wort. Vapi hat dafür **smart-endpointing** Heuristik (semantisch: „mein letzter Job war..." wartet länger als „ja.")

### 4.4 Filler Words & Backchannel
- Während LLM noch denkt: **„Mhm, verstehe..."** als sofortiger Pre-Roll → kaschiert 800ms Latenz
- In Vapi: `fillersEnabled: true`

### 4.5 Infrastruktur
- **Eigener Webhook in EU** (Frankfurt) → keine US-Round-Trip für Function Calls
- **Custom LLM Endpoint** via Vapi: eigenes vLLM/TGI in eu-central-1 mit Llama 3.3 70B Speculative Decoding → unter 200ms TTFT möglich
- **Private Net** zwischen Vapi und LLM-Provider (wenn Enterprise)

### 4.6 Architektur-Tricks
- **Speculative Generation**: parallel zwei kürzere LLM-Calls (z. B. „Ack-Phrase" + „echte Antwort"), erste wird sofort gesprochen
- **Prompt Caching** (OpenAI / Anthropic): System-Prompt wird gecacht → -50% TTFT bei Anthropic
- **Knowledge Base lokal halten** statt RAG mit externer Vector-DB
- **Tool-Calls minimieren** während des Calls (jeder Function-Call = +500-1000ms)

### Realistisches Target nach allen Hebeln
**End-to-End-Latency: 500-700ms** → fühlt sich an wie ein flüssiges menschliches Gespräch.

---

## 5. Eigenes Transkript statt Vapi-Transkript – wie und warum?

### Wie (mehrere Pfade)
1. **Vapi Recording-URL ziehen** (`call.recordingUrl` aus end-of-call-report) → Audio-File (mono/stereo) → eigene STT-Pipeline:
   - **AssemblyAI** (Diarization, Sentiment, Topic Detection in einem Call)
   - **Deepgram direkt** mit `diarize: true, smart_format: true`
   - **Whisper (large-v3) selbst gehostet** auf eigener GPU (AWS g5/g6 in Frankfurt)
   - **AWS Transcribe** (Region: eu-central-1)
2. **Live-Sidecar:** Vapi `call.listenUrl` (WebSocket-Stream des Live-Audios) → parallel zweite STT mit Diarization
3. **Eigenes Recording vor Vapi** via SIP-Trunk-Tap (z. B. via Twilio Media Streams Fork) → vollständige Kontrolle über Audio-File

### Warum sinnvoll?
| Grund | Detail |
|---|---|
| **DSGVO / Datenresidenz** | Vapi-Transkript läuft über US-Cloud. Eigene STT in EU = saubere Rechtsbasis, Art. 28 AVV mit lokalem Anbieter |
| **Genauigkeit** | Whisper-large-v3 oder AssemblyAI Universal-2 oft 5-15% genauer auf deutschem Fachvokabular als Vapi-Default |
| **Speaker Diarization** | Vapi-Transkript trennt Speaker oft schwächer. Eigene Pipeline mit `pyannote` liefert sauberer „Speaker 0 vs. 1" für Protokoll |
| **Custom Vocabulary** | Eigene Domain-Begriffe (Tools, Produkte, Personen) deterministisch ins Vocabulary → keine Mishearings bei „HubSpot" / „Outreach.io" |
| **Vendor Lock-in vermeiden** | Bei Vapi-Wechsel (Retell, LiveKit, Bland) gehen Transkripte nicht verloren → Audio bleibt Quelle der Wahrheit |
| **Forensik & Compliance** | Originale Audio-Files sind beweissicher (Hash-Chain möglich), Transkripte können nachträglich re-prozessiert werden, wenn STT besser wird |
| **Multi-Modal Auswertung** | Eigene Pipeline kann auch **Tonalität, Sprechgeschwindigkeit, Pausen, Lachen, Unsicherheit** extrahieren – wertvoll für Soft-Skill-Bewertung |
| **Kostenkontrolle** | Bei hohem Volume eigenes Whisper deutlich günstiger als Per-Minute STT-Gebühren |

### Empfohlene Architektur (Hybrid)
- **Live:** Vapi-internes STT für Echtzeit-Reaktion (Latenz kritisch)
- **Post-Call:** Eigenes Re-Transcribe mit Whisper-large-v3 + Diarization → **das** Transkript wird zur Auswertung / Slack-Protokoll verwendet
- Vapi-Transkript nur als Fallback / Cross-Check

---

## 6. Bonus: Setup ohne Datentransfer in die USA

**Realitäts-Check:** Vapi selbst ist ein **US-Unternehmen** und nutzt primär US-Infrastruktur. Ein **100% USA-freies** Setup mit Vapi ist offiziell **aktuell nicht garantierbar**. Optionen:

### Option A: Vapi mit DSGVO-Härtung
- **AVV / DPA mit Vapi abschließen** (sie haben einen Standard-DPA mit SCCs)
- **Custom LLM Endpoint** auf eigenem EU-Server → LLM-Daten bleiben in EU
- **Custom STT/TTS Provider** wo möglich (Vapi lässt eigene Endpoints zu)
- **Webhook-Server** in EU (AWS Frankfurt / Hetzner)
- **Daten-Minimierung:** keine PII im Prompt, Recordings sofort nach Auswertung aus Vapi löschen
- ⚠️ Audio läuft trotzdem durch Vapi-Cloud (US) → kritisch für strenge DSGVO-Anforderungen

### Option B: Vapi-Alternative mit EU-Hosting
- **Retell AI** – bietet EU-Region (Frankfurt)
- **LiveKit Agents** (Open Source) selbst gehostet → volle Kontrolle
- **Pipecat** (Open Source von Daily) → self-hostbar

### Option C: Komplett-Self-Hosted Stack (DSGVO-Goldstandard)
```
SIP-Trunk (Sipgate / Telekom)
  → FreeSWITCH / Asterisk (AWS Frankfurt)
  → LiveKit / Pipecat
  → Deepgram On-Prem oder Whisper auf eigenem GPU-Server
  → Llama 3.3 70B / Mistral Large auf vLLM in eu-central-1
  → Coqui XTTS-v2 / Piper TTS
  → eigener Recording-Storage (S3 eu-central-1, SSE-KMS)
```

### Checkliste DSGVO-Compliance
- [ ] **AVV** mit jedem Provider (Vapi, OpenAI/Anthropic, ElevenLabs, Slack, AWS)
- [ ] **SCCs** (Standard Contractual Clauses) für unvermeidbare US-Transfers
- [ ] **TIA** (Transfer Impact Assessment) dokumentiert
- [ ] **Einwilligung Kandidat** vor Call-Start: explizit ansagen „Dieses Gespräch wird aufgezeichnet und KI-gestützt ausgewertet, Widerspruch möglich" → Opt-out-Pfad zu menschlichem Recruiter
- [ ] **Datenminimierung:** Recording max. 30 Tage, dann Löschung
- [ ] **Verzeichnis Verarbeitungstätigkeiten** (Art. 30 DSGVO) gepflegt
- [ ] **Betroffenenrechte** umgesetzt (Auskunft, Löschung) – Slack-Protokoll muss löschbar sein
- [ ] **Hosting EU-Region** überall wo möglich
- [ ] **TLS überall**, Daten at-rest verschlüsselt (KMS)
- [ ] **Pseudonymisierung**: Kandidat-Name nur in HR-System, nicht im LLM-Prompt (IDs reichen)

### Realistische Empfehlung für EverlastAI
Für den **PoC**: Vapi + DPA + EU-Webhook → reicht für Testbetrieb.
Für den **produktiven Rollout**: Migration auf **LiveKit Agents self-hosted in AWS Frankfurt** sobald Volumen es rechtfertigt.

---

## 7. Bonus: AWS-Integration mit Vapi – wie und worauf achten?

Vapi ist offen für externe Endpoints – AWS lässt sich an mehreren Punkten der Pipeline einklinken:

### 7.1 Webhook-Backend
- **API Gateway → Lambda** (Node 20) als `serverUrl` für Vapi
- Lambda verifiziert Vapi-Signature, schreibt Roh-Event in **EventBridge**
- **EventBridge Rules** routen: `end-of-call-report` → SQS → Worker-Lambda (Auswertung) → Slack

### 7.2 LLM via AWS Bedrock
- **Vapi Custom LLM Endpoint** (OpenAI-kompatibel) zeigt auf **Lambda mit Function URL**, die Bedrock-Claude-3.5-Sonnet aufruft
- **Region: eu-central-1** → Daten bleiben in Frankfurt
- Bedrock hat **kein Training auf Kundendaten** + Enterprise-Compliance (SOC2, HIPAA)

### 7.3 STT-Alternative
- **AWS Transcribe** (Streaming) als STT-Provider
- Real-Time-Transcription mit `medical/general`, eu-central-1
- Custom Vocabulary für Domain-Begriffe

### 7.4 TTS-Alternative
- **AWS Polly Neural / Generative** als TTS – günstig, EU-Region, gut für „solide aber nicht premium" Voice
- Für deutschen Phone-Screen reicht Polly nicht ganz an ElevenLabs ran, aber DSGVO-clean

### 7.5 Storage & Analytics
- **S3 (eu-central-1)** mit SSE-KMS für Recordings & Transkripte (Lifecycle-Rule: nach 30 Tagen → Glacier oder Delete)
- **DynamoDB** für Call-Metadata (CallId, KandidatId, Score, Recommendation)
- **OpenSearch** für Volltextsuche über alle Transkripte (HR-Dashboard)
- **Athena** auf S3-Logs für Reporting („wie viele NO-GOs pro Woche?")

### 7.6 Sicherheit
- **Secrets Manager** für `OPENAI_API_KEY`, `VAPI_SECRET`, `SLACK_WEBHOOK_URL`
- **IAM Least-Privilege** pro Lambda
- **VPC Endpoints** für Bedrock/S3 → kein Internet-Egress
- **WAF** auf API Gateway gegen Replay-Attacks

### 7.7 Worauf achten
| Punkt | Detail |
|---|---|
| **Cold Starts** | Lambda Cold Start kann 800ms+ kosten → für Webhook-Tail unkritisch, für Custom-LLM kritisch → **Provisioned Concurrency** oder Fargate |
| **Bedrock Quotas** | Default-Quotas sind niedrig (z. B. 50 RPM Claude Sonnet) → früh Limit Increase beantragen |
| **Region-Verfügbarkeit** | Nicht jedes Bedrock-Modell ist in eu-central-1 verfügbar → Cross-Region-Inference oder Modell-Wahl anpassen |
| **Data Egress Cost** | Audio von Vapi (US) zu S3 (EU) verursacht Transfer-Kosten + Latenz → wenn möglich Vapi-Region auf EU stellen (falls verfügbar) |
| **Idempotenz** | Vapi retried bei 5xx → Webhook-Handler muss idempotent sein (DynamoDB Conditional Put auf CallId) |
| **PII in CloudWatch** | Lambda darf keine Transkripte in CloudWatch Logs schreiben → strukturiertes Logging mit Masking |
| **Audit-Trail** | CloudTrail + S3-Access-Logs aktiviert für Compliance |

### Beispiel-Architektur (Vapi + AWS, EU-konform)
```
Vapi (Custom LLM Endpoint)
        │
        │ HTTPS
        ▼
   API Gateway (eu-central-1)
        │
        ▼
   Lambda (LLM-Proxy)
        │
        ▼
   Bedrock (Claude Sonnet, eu-central-1)

Vapi (end-of-call-report)
        │
        ▼
   API Gateway
        │
        ▼
   Lambda (Webhook-Receiver) → EventBridge
        │                          │
        ▼                          ▼
       S3 (Recording)         SQS → Worker-Lambda
                                    │
                                    ├→ Bedrock (Auswertung)
                                    ├→ DynamoDB (Result)
                                    └→ Slack Webhook
```

---

## 8. Recht & Ethik – warum dieses Setup compliant ist
> **Das ist der Abschnitt, der mich von anderen Bewerbern unterscheidet.** KI in der
> Personalauswahl ist rechtlich heikel – wer das *proaktiv* mitdenkt, baut ein Produkt,
> das EverlastAI auch an deutsche Enterprise-Kunden verkaufen kann.

### 8.1 AGG (Allgemeines Gleichbehandlungsgesetz)
Ein Voice-Agent darf **nicht mittelbar diskriminieren** – z. B. anhand von Akzent, Dialekt,
Stimmlage (Geschlecht/Alter), Sprachniveau bei Nicht-Muttersprachlern.
**Mitigation im Design:**
- Bewertung **nur nach job-relevanten Kriterien** (Sales-Erfahrung, Tool-Kenntnis, Outbound-Komfort) – nicht nach „wie deutsch klingt jemand".
- **Feste Rubrik** statt freiem Bauchgefühl → konsistente, nachvollziehbare Scores.
- Sprachniveau wird **nur erfasst, wenn job-relevant** (Sales = viel Kundenkontakt), nie als K.-o.-Kriterium gegen Akzent.
- **Bias-Monitoring:** regelmäßiger Abgleich der Scores über demografische Gruppen.

### 8.2 EU AI Act – Hochrisiko-System
KI zur **Bewertung von Bewerbern fällt unter Annex III → „Hochrisiko"**. Daraus folgende Pflichten, die wir erfüllen:
| Pflicht | Umsetzung im Setup |
|---|---|
| **Transparenz** | Agent sagt zu Beginn an, dass es KI ist + Recording + Auswertung (im System-Prompt, Phase 1) |
| **Menschliche Aufsicht** | Agent **entscheidet nie** – HR klickt „Einladen/Ablehnen" in Slack (Human-in-the-Loop) |
| **Logging / Nachvollziehbarkeit** | Transkript + Recording + strukturiertes Protokoll werden gespeichert |
| **Bias-Monitoring** | Scores werden geloggt → spätere Eichung gegen echte HR-Entscheidungen |
| **Doku / Risikomanagement** | Rubrik, Prompt, Datenflüsse dokumentiert |

### 8.3 DSGVO Art. 22 – keine vollautomatisierte Entscheidung
Art. 22 verbietet **automatisierte Einzelentscheidungen mit rechtlicher Wirkung** (z. B.
„KI lehnt Bewerber ab"). Deshalb ist das System bewusst als **Entscheidungs*unterstützung***
gebaut: Der Agent **screent und protokolliert, der Mensch entscheidet.**
- **Einwilligung** vor Call-Start (Phase 1 im Prompt).
- **Opt-out** zu einem menschlichen Recruiter jederzeit möglich.

### 8.4 Der eine Satz für den Call
> *„Der Agent screent und erstellt ein strukturiertes Protokoll – die Entscheidung trifft
> immer ein Mensch. Damit ist das Setup AGG-, DSGVO-Art.-22- und EU-AI-Act-konform aufgesetzt,
> nicht nur technisch sauber, sondern auch verkaufbar an deutsche Enterprise-Kunden."*

---

## 9. Kostenmodell pro Call
Grobe Schätzung für ein **10-Minuten-Interview** (Größenordnungen, nicht auf den Cent):

| Komponente | ~Kosten / 10-Min-Call |
|---|---|
| Vapi-Plattformgebühr | ~$0,05/Min → **~$0,50** |
| STT (Deepgram, in Vapi) | ~$0,01–0,02/Min → **~$0,15** |
| LLM-Conversation (GPT-4o-mini) | **~$0,05** (kurze Turns, maxTokens 150) |
| TTS (ElevenLabs Turbo) | **~$0,30–0,50** (abhängig vom Sprechanteil) |
| Auswertung (GPT-4o, 1× post-call) | **~$0,02** |
| **Summe pro Call** | **~$1,00–1,30** |

**Hochrechnung 500 Calls/Monat: ~$500–650/Monat.**
Vergleich: Ein menschlicher Recruiter braucht für 500 Erstgespräche à 15 Min ≈ **125 Stunden**.
→ Der Agent ist nicht nur billiger, er **skaliert ohne Personalengpass** und liefert
**konsistente, dokumentierte** Protokolle.

**Kosten-Hebel:** kleineres LLM, Cartesia statt ElevenLabs (günstiger + schneller),
eigenes Whisper bei hohem Volumen, kürzere Calls durch fokussierten Prompt.

---

## 10. Skalierung & Betrieb
Was sich vom PoC zum Produktivbetrieb ändert:

| Thema | PoC (Demo) | Produktiv |
|---|---|---|
| **Webhook-Empfang** | Express + ngrok | API Gateway + Lambda (oder Fargate) in EU |
| **Idempotenz** | – | Vapi retried bei 5xx → Conditional Put auf `callId` (DynamoDB), damit kein Doppel-Slack |
| **Last** | direkt verarbeitet | `end-of-call-report` → SQS-Queue → Worker (entkoppelt Spitzen, z. B. 100 parallele Calls) |
| **Monitoring** | Terminal-Logs | CloudWatch Alarms, Dead-Letter-Queue, Slack-Alert bei Fehler |
| **Concurrency** | 1 Call | Vapi-Concurrency-Limit beachten, ggf. Enterprise-Plan |
| **Datenhaltung** | – | S3 (Recording) + DynamoDB (Metadaten) + Lösch-Lifecycle (30 Tage) |
| **Secrets** | `.env` | AWS Secrets Manager |

**Failure-Modes, die ich bedacht habe:** Vapi-Retry-Storm (→ Idempotenz), zu kurzes
Transkript (→ Skip + Log), LLM-Timeout (→ Retry mit Backoff), Slack down (→ Queue + Re-Send).

---

## 11. Build vs. No-Code vs. Hybrid – die Architektur-Entscheidung
> Häufige (und berechtigte) Frage: *„Ist Custom Code langfristig nicht schwerer zu warten als
> No-Code, wo alles verbunden ist und Plattform-Updates automatisch kommen?"* – Die Achse
> „Code oder No-Code" ist die falsche. Entscheidend ist: **welche Schicht?**

### Der Stack hat drei Schichten – nur eine ist überhaupt „Custom Code"
1. **Der Voice-Agent** (Stimme, Modell, Prompt, Latenz, Transkript) → lebt **komplett in Vapi**.
   Plattform-Updates (neue Voice-Modelle, besseres Endpointing) bekommt man **in beiden
   Varianten automatisch**.
2. **Die Auswertung** (Transkript → Score → Empfehlung) → die eigentliche Intelligenz & Compliance.
3. **Die Glue/Integration** (Webhook → Slack, Routing) → der Klebstoff.

Das Wartungs-Argument greift nur bei **Schicht 3**.

### Ehrlicher Vergleich
| | Custom Code | No-Code (Make/n8n) |
|---|---|---|
| **Stärken** | Kontrolle, Tests, Git/Review, komplexe Logik, keine Per-Task-Kosten | Schnell gebaut, gepflegte Konnektoren, auch von Nicht-Entwicklern wartbar |
| **Schwächen** | Eigenwartung, Engineer nötig, API-Änderungen selbst nachziehen | Kein Versioning/Test/Review, opakes Debugging, Kosten pro Task, Abhängigkeit vom Konnektor-Timing |

**Der häufige Denkfehler:** „No-Code fängt Plattform-Updates automatisch ab." Wenn Vapi sein
Payload ändert, bricht **beides** – bei No-Code wartet man nur, bis der Anbieter den Konnektor
nachzieht (weniger Kontrolle über das Timing). Genau diese Payload-Robustheit ist im Code
**testbar** – meine Validierung hat dadurch 3 reale Bugs vor dem Demo-Tag gefangen.

### Empfehlung: Hybrid nach Halbwertszeit
> **Dünner, getesteter Code dort, wo die Logik *Wert* und *Compliance* trägt (die Auswertung).
> Plattform/No-Code dort, wo es nur *verbindet* (der Klebstoff).**

Konkret: Vapis **eingebaute Analyse** (`analysisPlan`, schon in der Config) nutzen, wo sie reicht –
den eigenen Analyzer nur dort behalten, wo man **Kontrolle über die Bewertungs-Rubrik** braucht.
Und HR-rechtlich (AGG) will man die Scoring-Logik bewusst **nicht** einer Blackbox überlassen.

---

## Anhang
- Vapi-Config zum Import: [`vapi/assistant-config.json`](vapi/assistant-config.json)
- System Prompt: [`vapi/system-prompt.md`](vapi/system-prompt.md)
- Demo-Server-Code: [`webhooks/server.ts`](webhooks/server.ts)
- Architecture-Diagramm: [`architecture/flow-diagram.md`](architecture/flow-diagram.md)
