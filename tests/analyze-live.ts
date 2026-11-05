// Echter Integrationstest gegen die OpenAI-API.
// Lauf: npx tsx --env-file=.env tests/analyze-live.ts
import { analyzeInterview } from "../webhooks/analyzer";

const transcript = `
AI: Hallo, hier ist Lena von EverlastAI. Schön, dass du dir die Zeit nimmst. Hast du gerade zehn Minuten für unser Erstgespräch?
Kandidat: Ja klar, passt gut.
AI: Super. Erzähl mir kurz, was du gerade machst und warum dich die SDR-Rolle bei EverlastAI interessiert.
Kandidat: Ich arbeite seit drei Jahren im B2B-Vertrieb, aktuell als SDR bei einem SaaS-Startup. Ich mache hauptsächlich Outbound, also Cold Calls und Cold Mails. Mich reizt an EverlastAI das KI-Thema, weil ich glaube, dass Voice-Agents den Vertrieb stark verändern werden, und da will ich früh dabei sein.
AI: Spannend. Wie sieht denn ein typischer Tag bei dir aus, wie viele Calls machst du?
Kandidat: So 50 bis 70 Wählversuche am Tag, daraus vielleicht 10 echte Gespräche und ein, zwei qualifizierte Termine. Ich arbeite mit HubSpot und Salesloft.
AI: Stell dir vor, du rufst kalt einen gestressten CMO an. Wie öffnest du das Gespräch?
Kandidat: Ich würde ehrlich sein: "Hi, ich weiß, ich rufe ungelegen an, geben Sie mir 30 Sekunden und dann entscheiden Sie, ob es sich lohnt?" Dann ein kurzer, konkreter Wertsatz, der auf seine Rolle passt.
AI: Welche Methodik nutzt du?
Kandidat: Hauptsächlich eine Mischung aus MEDDIC für die Qualifizierung und ein bisschen SPIN für die Gesprächsführung.
AI: Wann könntest du frühestens starten und was sind deine Gehaltsvorstellungen?
Kandidat: Ich habe vier Wochen Kündigungsfrist. Bei der Vergütung stelle ich mir so 55.000 Euro Fixum vor, plus Bonus.
AI: Super, vielen Dank für das Gespräch! Du hörst spätestens in 48 Stunden von uns. Schönen Tag noch!
Kandidat: Danke dir, tschüss!
`;

(async () => {
  console.log("→ Rufe OpenAI für Auswertung auf...\n");
  const t0 = Date.now();
  const report = await analyzeInterview({
    callId: "live-test-1",
    transcript,
    durationSec: 360,
    recordingUrl: "https://example.com/rec.wav",
  });
  const ms = Date.now() - t0;
  console.log(JSON.stringify(report, null, 2));
  console.log(`\n✅ Auswertung erfolgreich in ${(ms / 1000).toFixed(1)}s`);
  console.log(`   → Empfehlung: ${report.recommendation} (${report.overall_score}/10)`);
})().catch((e) => { console.error("❌ Fehler:", e.message); process.exit(1); });
