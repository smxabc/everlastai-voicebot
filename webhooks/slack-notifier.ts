import type { CandidateReport, Recommendation } from "./analyzer";

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL ?? "";

const BADGE: Record<Recommendation, string> = {
  GO: ":white_check_mark: *GO*",
  MAYBE: ":warning: *MAYBE*",
  NO_GO: ":x: *NO-GO*",
};

function scoreBar(score: number): string {
  const filled = Math.round(score);
  return "█".repeat(filled) + "░".repeat(10 - filled) + ` ${score}/10`;
}

export async function sendCandidateReportToSlack(
  report: CandidateReport,
  ctx: { recordingUrl?: string; callId: string },
): Promise<void> {
  if (!SLACK_WEBHOOK_URL) {
    console.warn("SLACK_WEBHOOK_URL not set — skipping Slack notification");
    return;
  }

  const blocks: unknown[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${report.candidate_name} – ${report.role_applied}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${BADGE[report.recommendation]}  ·  Overall: *${report.overall_score}/10*  ·  Dauer: ${report.duration_min} Min`,
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Begründung*\n${report.reasoning}` },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Sprache*\n\`${scoreBar(report.language_quality.score)}\`` },
        { type: "mrkdwn", text: `*Sales Erfahrung*\n\`${scoreBar(report.sales_experience.score)}\`` },
        { type: "mrkdwn", text: `*Outbound Komfort*\n\`${scoreBar(report.outbound_comfort.score)}\`` },
        { type: "mrkdwn", text: `*Motivation*\n\`${scoreBar(report.motivation.score)}\`` },
        { type: "mrkdwn", text: `*Kommunikation*\n\`${scoreBar(report.communication_skills.score)}\`` },
        { type: "mrkdwn", text: `*Erfahrung*\n${report.sales_experience.years} Jahre` },
      ],
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Highlights*\n${report.highlights.map((h) => `• ${h}`).join("\n") || "_keine_"}\n\n` +
          `*Red Flags*\n${report.red_flags.map((r) => `• ${r}`).join("\n") || "_keine_"}`,
      },
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Gehalt*\n${report.salary_expectation_eur ? `€${report.salary_expectation_eur.toLocaleString("de-DE")}` : "k. A."}`,
        },
        { type: "mrkdwn", text: `*Verfügbar in*\n${report.availability_weeks} Wochen` },
        { type: "mrkdwn", text: `*Tool-Stack*\n${report.tool_stack.join(", ") || "k. A."}`},
        { type: "mrkdwn", text: `*Branchen*\n${report.sales_experience.industries.join(", ") || "k. A."}`},
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Follow-up Fragen*\n${report.follow_up_questions.map((q) => `• ${q}`).join("\n") || "_keine_"}`,
      },
    },
    {
      type: "actions",
      elements: [
        ctx.recordingUrl && {
          type: "button",
          text: { type: "plain_text", text: "📞 Recording anhören" },
          url: ctx.recordingUrl,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "✅ Einladen" },
          style: "primary",
          value: `invite:${ctx.callId}`,
          action_id: "invite_candidate",
        },
        {
          type: "button",
          text: { type: "plain_text", text: "❌ Ablehnen" },
          style: "danger",
          value: `reject:${ctx.callId}`,
          action_id: "reject_candidate",
        },
      ].filter(Boolean),
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `Call ID: \`${ctx.callId}\` · automatisch ausgewertet von EverlastAI Voice Agent` },
      ],
    },
  ];

  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `Neuer Kandidat: ${report.candidate_name} – ${report.recommendation}`,
      blocks,
    }),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${await res.text()}`);
  }
}
