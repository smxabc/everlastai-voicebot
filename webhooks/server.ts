import express, { Request, Response } from "express";
import crypto from "crypto";
import { analyzeInterview } from "./analyzer";
import { sendCandidateReportToSlack } from "./slack-notifier";

const app = express();
app.use(express.json({ limit: "10mb" }));

const VAPI_SECRET = process.env.VAPI_SECRET ?? "";
const PORT = Number(process.env.PORT ?? 3000);

function verifyVapiSignature(req: Request): boolean {
  if (!VAPI_SECRET) return true;
  const provided = req.header("x-vapi-signature") ?? "";
  const body = JSON.stringify(req.body);
  const expected = crypto.createHmac("sha256", VAPI_SECRET).update(body).digest("hex");
  // HMAC beide Seiten zu fixer Länge, damit timingSafeEqual bei Längen-Mismatch
  // nicht wirft (sonst 500 statt sauberem Abweisen). Verhindert Demo-Crash.
  const a = crypto.createHmac("sha256", VAPI_SECRET).update(provided).digest();
  const b = crypto.createHmac("sha256", VAPI_SECRET).update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

// Vapi-Payload-Felder liegen je nach Version unter message.* oder message.artifact.*
// Robust aus mehreren möglichen Stellen lesen, damit die Demo nicht an einem
// umbenannten Feld scheitert.
function pick<T>(...vals: (T | undefined | null)[]): T | undefined {
  return vals.find((v) => v !== undefined && v !== null) as T | undefined;
}

app.post("/vapi/events", async (req: Request, res: Response) => {
  if (!verifyVapiSignature(req)) {
    return res.status(401).json({ error: "invalid signature" });
  }

  const message = req.body?.message;
  const type = message?.type;

  res.status(200).json({ received: true });

  if (type !== "end-of-call-report") return;

  try {
    const call = message.call;
    const artifact = message.artifact ?? {};
    const transcript: string = pick<string>(message.transcript, artifact.transcript) ?? "";
    const recordingUrl: string | undefined = pick<string>(
      message.recordingUrl, artifact.recordingUrl, message.recordingUrl,
      artifact.recording?.stereoUrl, artifact.recording?.mono?.combinedUrl,
    );
    const durationSec: number = pick<number>(message.durationSeconds, message.durationSec) ?? 0;
    const callId: string = pick<string>(call?.id, message.call?.id) ?? "unknown";

    if (!transcript || transcript.length < 200) {
      console.warn(`[${callId}] transcript too short, skipping analysis`);
      return;
    }

    const report = await analyzeInterview({
      callId,
      transcript,
      durationSec,
      recordingUrl,
    });

    await sendCandidateReportToSlack(report, { recordingUrl, callId });

    console.log(`[${callId}] processed → ${report.recommendation} (${report.overall_score}/10)`);
  } catch (err) {
    console.error("end-of-call-report handler failed:", err);
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`EverlastAI webhook listening on :${PORT}`);
});
