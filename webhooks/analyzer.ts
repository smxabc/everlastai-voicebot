import OpenAI from "openai";

// Lazy-Init: Client erst bei Bedarf erzeugen. Sonst crasht der gesamte Server
// schon beim Start, wenn OPENAI_API_KEY fehlt (OpenAI-SDK wirft im Konstruktor).
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY fehlt — in .env eintragen (siehe SETUP.md).");
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export type Recommendation = "GO" | "MAYBE" | "NO_GO";

export interface ScoreBlock {
  score: number;
  notes: string;
}

export interface CandidateReport {
  call_id: string;
  candidate_name: string;
  role_applied: string;
  duration_min: number;
  language_quality: ScoreBlock;
  sales_experience: { years: number; industries: string[]; score: number };
  outbound_comfort: { score: number; evidence: string };
  tool_stack: string[];
  motivation: ScoreBlock;
  communication_skills: ScoreBlock;
  red_flags: string[];
  highlights: string[];
  salary_expectation_eur: number | null;
  availability_weeks: number;
  overall_score: number;
  recommendation: Recommendation;
  reasoning: string;
  follow_up_questions: string[];
}

const SYSTEM_PROMPT = `Du bist Senior Recruiter bei EverlastAI und bewertest ein Erstgespräch mit einer SDR-Kandidatin.
Du erhältst das Transkript und gibst ein striktes JSON-Protokoll zurück.

Bewertungs-Rubrik (Skala 1-10):
- language_quality: Deutschniveau, Klarheit, Artikulation
- sales_experience: Tiefe und Relevanz bisheriger Sales-Tätigkeiten
- outbound_comfort: Reaktion auf Cold-Call-Rollenspiel, Souveränität
- motivation: Stimmigkeit zwischen Lebenslauf, Wunschrolle und EverlastAI
- communication_skills: Strukturiertes Antworten, Rückfragenqualität

Empfehlungs-Logik:
- GO: overall_score >= 8, keine kritischen Red Flags
- MAYBE: overall_score 6-7, oder hohes Potenzial aber Lücke (z. B. wenig Outbound)
- NO_GO: overall_score < 6 oder kritische Red Flags (Unzuverlässigkeit, fachlich klar zu wenig, Sprachniveau unzureichend)

Sei fair, konsistent, datenbasiert. Belege Scores mit Zitaten aus dem Transkript wo möglich.`;

const JSON_SCHEMA = {
  name: "CandidateReport",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      candidate_name: { type: "string" },
      role_applied: { type: "string" },
      language_quality: {
        type: "object",
        additionalProperties: false,
        properties: { score: { type: "number" }, notes: { type: "string" } },
        required: ["score", "notes"],
      },
      sales_experience: {
        type: "object",
        additionalProperties: false,
        properties: {
          years: { type: "number" },
          industries: { type: "array", items: { type: "string" } },
          score: { type: "number" },
        },
        required: ["years", "industries", "score"],
      },
      outbound_comfort: {
        type: "object",
        additionalProperties: false,
        properties: { score: { type: "number" }, evidence: { type: "string" } },
        required: ["score", "evidence"],
      },
      tool_stack: { type: "array", items: { type: "string" } },
      motivation: {
        type: "object",
        additionalProperties: false,
        properties: { score: { type: "number" }, notes: { type: "string" } },
        required: ["score", "notes"],
      },
      communication_skills: {
        type: "object",
        additionalProperties: false,
        properties: { score: { type: "number" }, notes: { type: "string" } },
        required: ["score", "notes"],
      },
      red_flags: { type: "array", items: { type: "string" } },
      highlights: { type: "array", items: { type: "string" } },
      salary_expectation_eur: { type: ["number", "null"] },
      availability_weeks: { type: "number" },
      overall_score: { type: "number" },
      recommendation: { type: "string", enum: ["GO", "MAYBE", "NO_GO"] },
      reasoning: { type: "string" },
      follow_up_questions: { type: "array", items: { type: "string" } },
    },
    required: [
      "candidate_name", "role_applied", "language_quality", "sales_experience",
      "outbound_comfort", "tool_stack", "motivation", "communication_skills",
      "red_flags", "highlights", "salary_expectation_eur", "availability_weeks",
      "overall_score", "recommendation", "reasoning", "follow_up_questions",
    ],
  },
  strict: true,
} as const;

export async function analyzeInterview(input: {
  callId: string;
  transcript: string;
  durationSec: number;
  recordingUrl?: string;
}): Promise<CandidateReport> {
  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-4o-2024-11-20",
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Transkript (Dauer ${Math.round(input.durationSec / 60)} Min):\n\n${input.transcript}`,
      },
    ],
    response_format: { type: "json_schema", json_schema: JSON_SCHEMA },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);

  return {
    call_id: input.callId,
    duration_min: Math.round(input.durationSec / 60),
    ...parsed,
  };
}
