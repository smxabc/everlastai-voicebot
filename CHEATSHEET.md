# CHEATSHEET – Spickzettel für den Call (Do, 04.06.)

> Zweiter Bildschirm / ausgedruckt. Nicht vorlesen – nur Stützen. Du **erklärst**, du liest nicht ab.

---

## 30-Sekunden-Pitch (so eröffnest du)
„Ich habe einen Vapi-Voice-Agent gebaut, der Erstgespräche für eine SDR-Rolle führt. Er
spricht natürlich Deutsch, folgt einem strukturierten 7-Phasen-Interview, und schickt direkt
nach dem Call ein fertiges Bewerberprotokoll mit Scoring und Empfehlung nach Slack – der
HR-Manager klickt dann nur noch Einladen oder Ablehnen. Ich zeig's euch am besten direkt live."

---

## Warum jede Einstellung? (Ein-Satz-Begründungen – auswendig)
| Einstellung | Begründung in einem Satz |
|---|---|
| **STT: Deepgram Nova-2** | Bestes Echtzeit-Streaming-STT für Deutsch, in Vapi nativ, niedrige Latenz. |
| **Endpointing 250ms** | Default 500ms ist zu träge – 250ms lässt den Agent schneller antworten, ohne ständig ins Wort zu fallen. |
| **Custom Keywords (SDR, HubSpot…)** | Verhindert Verhörer bei Fachbegriffen → sauberes Transkript für die Auswertung. |
| **LLM: GPT-4o-mini** | Schnell genug für flüssiges Gespräch, klug genug zum Interviewen – großes Modell wäre langsamer ohne Mehrwert im Smalltalk. |
| **maxTokens 150** | Zwingt kurze, natürliche Antworten – niemand will einen Monolog am Telefon. |
| **temperature 0.3** | Konsistent, aber nicht steif-roboterhaft. |
| **TTS: ElevenLabs Turbo v2.5** | Natürlichste deutsche Stimme bei niedriger Latenz – wichtig, damit Bewerber sich öffnen. |
| **Filler Words an** | „mhm, also…" während das LLM denkt → kaschiert Latenz, wirkt menschlich. |
| **Auswertung: GPT-4o (groß), temp 0.1** | Hier zählt Genauigkeit, nicht Speed – läuft einmalig nach dem Call, also darf es das große Modell sein. |
| **JSON-Schema (strict)** | Erzwingt strukturierte, maschinenlesbare Scores statt Fließtext → direkt in Slack-Blocks. |
| **Human-in-the-Loop (Slack-Buttons)** | Rechtlich nötig (Art. 22 DSGVO) UND besser: KI empfiehlt, Mensch entscheidet. |

---

## Bestes Voice-Modell – die Kurzfassung
**ElevenLabs Turbo v2.5** als Default, weil im Recruiting **Natürlichkeit > 200ms Latenz-Vorteil** –
ein Bewerber, der einen Roboter hört, öffnet sich nicht → schlechtere Datenqualität.
**Cartesia Sonic** (~90ms) wenn Latenz/Kosten kritisch werden. **Azure Neural (EU-Region)** wenn DSGVO-Hosting Priorität hat.

## Latenz senken – die 4 Haupthebel (falls gefragt)
1. **Kleines LLM** (4o-mini/Haiku) + maxTokens-Limit
2. **Streaming end-to-end** (STT, LLM, TTS chunked)
3. **Endpointing tunen** (250ms) + Filler Words zum Kaschieren
4. **Infra in EU** + ggf. Custom-LLM-Endpoint → Ziel **500–700ms**

## Eigenes Transkript – warum (1 Satz)
„Vapi-Transkript läuft über US-Cloud und ist mittelmäßig genau – mit eigenem Whisper/AssemblyAI
in der EU bekomme ich **DSGVO-Konformität, bessere Genauigkeit, Speaker-Trennung und Unabhängigkeit
vom Anbieter**, plus Audio als beweissichere Quelle."

---

## Antizipierte GF-Fragen → deine Antworten
**„Was, wenn der Agent halluziniert oder falsch bewertet?"**
→ Drei Sicherungen: feste Rubrik (kein Bauchgefühl), Scoring nur auf Transkript-Evidenz, und
**ein Mensch entscheidet** – das Protokoll ist Vorschlag, kein Urteil. Recording bleibt als Beleg.

**„Ist das überhaupt erlaubt? Datenschutz, Diskriminierung?"**
→ Ja, weil so aufgesetzt: **AGG** (nur job-relevante Kriterien, kein Akzent-Bias), **DSGVO Art. 22**
(keine Auto-Entscheidung, Einwilligung + Opt-out), **EU AI Act** (Hochrisiko → Transparenz, menschliche
Aufsicht, Logging). Genau das macht's auch an Enterprise-Kunden verkaufbar.

**„Was kostet das?"**
→ ~1–1,30 $ pro 10-Min-Call, ~500–650 $ bei 500 Calls/Monat. Ein Mensch bräuchte dafür ~125 Stunden.

**„Warum Vapi und nicht selbst bauen?"**
→ Time-to-Market: Vapi orchestriert STT+LLM+TTS+Telefonie out-of-the-box → in Tagen ein PoC.
Bei Skalierung/strenger DSGVO würde ich auf **self-hosted LiveKit in AWS Frankfurt** migrieren.

**„Warum Custom Code und nicht No-Code (Make/n8n)? Ist Code langfristig nicht schwerer wartbar?"**
→ Falsche Achse – es kommt auf die Schicht an. Der **Voice-Agent lebt in Vapi** (Plattform-Updates
bekomme ich so oder so automatisch). Code ist nur der dünne Klebstoff + die Auswertung. No-Code
ist top für den Klebstoff, aber: kein Git/Test/Review, opakes Debugging, Kosten pro Task,
Abhängigkeit vom Konnektor-Timing. „No-Code fängt Updates automatisch ab" ist ein Mythos – bei
einer Payload-Änderung bricht beides. **Meine Lösung: Hybrid** – dünner getesteter Code wo Logik &
Compliance zählen (Auswertung, AGG-Rubrik), Plattform/No-Code wo es nur verbindet. Vapis eingebaute
Analyse nutze ich, wo sie reicht. → Zeigt Trade-off-Denken statt Lieblingstechnik.

**„Wie verhinderst du, dass jemand den Bot austrickst / Prompt-Injection?"**
→ Guardrails im System-Prompt (keine Zusagen, kein Off-Topic), kurze Turns, und die Bewertung
basiert auf **Evidenz im Transkript**, nicht auf Selbstauskunft. Recording als Gegenprobe.

**„Was, wenn die Verbindung abbricht / Mailbox / Bewerber schweigt?"**
→ Alles im Prompt abgefangen: Voicemail-Nachricht, Silence-Timeout (20s), „Bist du noch da?",
sauberer Call-Abschluss. Zu kurze Calls werden gar nicht erst ausgewertet.

**„Wie gut ist die deutsche Stimme wirklich?"**
→ Hört ihr gleich in der Demo – ElevenLabs Turbo trifft Tonfall und Pausen so gut, dass im Test
~40% nicht sicher waren, ob es ein Mensch ist.

**„Wie skaliert das auf 100 Calls gleichzeitig?"**
→ Queue (SQS) entkoppelt, Webhook idempotent gegen Vapi-Retries, Monitoring + Dead-Letter-Queue.
PoC läuft direkt, Produktiv läuft über AWS in EU.

**„Was würdest du als Nächstes verbessern?"**
→ Eigenes EU-Transkript einziehen, ATS-Anbindung (Personio/Greenhouse), A/B-Test verschiedener
Prompts, Bias-Dashboard über die Scores.

---

## Demo-Skript (exakte Reihenfolge)
1. Slides bis „LIVE-DEMO"-Folie.
2. **Webhook läuft?** Terminal zeigen (`npm run dev`), `ngrok` läuft.
3. **Slack #hr-candidates** sichtbar nebeneinander legen.
4. Vapi-Dashboard → Assistant → **„Talk to Assistant"** klicken.
5. Interview führen – als **solider Kandidat** (damit klares GO rauskommt). ~3–5 Min reichen,
   früher mit „Danke, das war's" beenden.
6. Call endet → **kurz warten** → Slack zeigt das Protokoll → durchgehen (Scores, Empfehlung, Buttons).
7. Zurück zu den Slides ab „Bewertung".

**Plan B (wenn Live scheitert):** sofort das **Backup-Video** abspielen, denselben Flow erklären.
Nicht rumfummeln – souverän auf Video wechseln.

---

## Generalproben-Checkliste (Do früh)
- [ ] `npm run dev` läuft, `/health` grün
- [ ] ngrok läuft, **aktuelle URL** in Vapi eingetragen
- [ ] 1 frischer Testcall heute früh → Slack grün
- [ ] Slack-Channel offen & sichtbar
- [ ] Backup-Video griffbereit
- [ ] Slides offen, Demo-Fenster vorbereitet, **Benachrichtigungen aus**
- [ ] Internet stabil / Handy-Hotspot als Fallback
- [ ] Cheatsheet auf 2. Bildschirm / ausgedruckt
- [ ] Mikro & Kamera getestet
- [ ] Wasser, ruhig durchatmen – du kennst dein Projekt besser als jeder im Raum.
