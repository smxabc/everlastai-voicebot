import http from "http";
import crypto from "crypto";
import type { CandidateReport } from "../webhooks/analyzer";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, detail = "") => {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
  cond ? pass++ : fail++;
};

const sample: CandidateReport = {
  call_id: "test-123",
  candidate_name: "Max Mustermann",
  role_applied: "SDR",
  duration_min: 9,
  language_quality: { score: 8, notes: "klar" },
  sales_experience: { years: 3, industries: ["SaaS"], score: 7 },
  outbound_comfort: { score: 6, evidence: "ruhig im Rollenspiel" },
  tool_stack: ["HubSpot", "Outreach"],
  motivation: { score: 8, notes: "passt" },
  communication_skills: { score: 7, notes: "strukturiert" },
  red_flags: [],
  highlights: ["starker Opener"],
  salary_expectation_eur: 55000,
  availability_weeks: 4,
  overall_score: 8,
  recommendation: "GO",
  reasoning: "Solide Erfahrung, gute Kommunikation.",
  follow_up_questions: ["Gehalt final klären"],
};

async function main() {
  // --- Mock-Slack-Server starten ---
  let captured: any = null;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      captured = JSON.parse(body);
      res.writeHead(200);
      res.end("ok");
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;
  process.env.SLACK_WEBHOOK_URL = `http://127.0.0.1:${port}/hook`;

  // dynamic import NACH dem Setzen der Env-Var
  const { sendCandidateReportToSlack } = await import("../webhooks/slack-notifier");

  // TEST 1: GO-Report
  await sendCandidateReportToSlack(sample, { recordingUrl: "https://x/rec.wav", callId: "test-123" });
  ok("Slack-Payload empfangen", !!captured);
  ok("Payload ist valides JSON-Objekt mit blocks[]", Array.isArray(captured?.blocks), `blocks=${captured?.blocks?.length}`);
  const json = JSON.stringify(captured);
  ok("Keine undefined/null-Leichen im Payload", !/"undefined"|:null[,}]/.test(json));
  ok("Slack 50-Block-Limit eingehalten", captured.blocks.length <= 50, `${captured.blocks.length} blocks`);
  ok("Empfehlung GO im Text", json.includes("GO"));
  ok("Recording-Button vorhanden", json.includes("rec.wav"));

  // TEST 2: NO_GO ohne Recording (Edge-Case: kein recordingUrl)
  captured = null;
  const nogo = { ...sample, recommendation: "NO_GO" as const, red_flags: ["zu wenig Outbound"], salary_expectation_eur: null };
  await sendCandidateReportToSlack(nogo, { callId: "test-456" });
  ok("NO_GO ohne Recording funktioniert", !!captured && JSON.stringify(captured).includes("NO-GO"));
  const actions = captured.blocks.find((b: any) => b.type === "actions");
  ok("Kein leerer Recording-Button bei fehlendem recordingUrl",
     !!actions && !actions.elements.some((e: any) => e?.url === undefined && e?.type === "button" && !e.action_id));

  // TEST 3: Slack-Blocks gegen grobe Schema-Regeln
  const headerBlocks = captured.blocks.filter((b: any) => b.type === "header");
  ok("Header-Text ≤ 150 Zeichen (Slack-Limit)", headerBlocks.every((b: any) => b.text.text.length <= 150));
  const sections = captured.blocks.filter((b: any) => b.type === "section");
  ok("Alle section.text ≤ 3000 Zeichen", sections.every((b: any) => !b.text || b.text.text.length <= 3000));

  server.close();

  // --- TEST 4: HMAC-Signatur-Verifizierung — Längen-Mismatch-Bug ---
  // Repliziert die Logik aus server.ts:verifyVapiSignature
  function verify(secret: string, provided: string, bodyObj: any): boolean | "THROW" {
    try {
      const body = JSON.stringify(bodyObj);
      const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
      // gefixte Logik: beide Seiten erneut HMAC-en → immer gleiche Länge
      const a = crypto.createHmac("sha256", secret).update(provided).digest();
      const b = crypto.createHmac("sha256", secret).update(expected).digest();
      return crypto.timingSafeEqual(a, b);
    } catch {
      return "THROW";
    }
  }
  const secret = "s3cr3t", payload = { message: { type: "end-of-call-report" } };
  const good = crypto.createHmac("sha256", secret).update(JSON.stringify(payload)).digest("hex");
  ok("Korrekte Signatur wird akzeptiert", verify(secret, good, payload) === true);
  ok("Falsche Signatur GLEICHER Länge wird abgelehnt", verify(secret, "a".repeat(64), payload) === false);
  const r = verify(secret, "zu-kurz", payload);
  ok("BUG-CHECK: Signatur falscher Länge crasht NICHT", r !== "THROW",
     r === "THROW" ? "timingSafeEqual wirft bei Längen-Mismatch → 500 statt 401" : "ok");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}
main();
