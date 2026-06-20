/**
 * lib/claude.ts — Groq free tier, Llama 3.3 70B
 * Single verdict + comparison verdict
 */
import type { WireSourceResult } from "./wire";

export type Verdict = {
  verdict: "BUY" | "WAIT" | "SKIP";
  confidence: number;
  supporting: string[];
  risks: string[];
  summary: string;
};

export type CompareResult = {
  productA: Verdict;
  productB: Verdict;
  winner: "A" | "B" | "TIE";
  reason: string;
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

async function callGroq(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

function safeParseJSON(raw: string): any {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    let fixed = cleaned;
    const ob = (fixed.match(/{/g) || []).length;
    const cb = (fixed.match(/}/g) || []).length;
    const oq = (fixed.match(/\[/g) || []).length;
    const cq = (fixed.match(/\]/g) || []).length;
    fixed += "]".repeat(oq - cq);
    fixed += "}".repeat(ob - cb);
    try {
      return JSON.parse(fixed);
    } catch {
      throw new Error("Could not parse LLM response: " + cleaned.slice(0, 200));
    }
  }
}

function validateVerdict(p: any): Verdict {
  if (!p.verdict || !["BUY", "WAIT", "SKIP"].includes(p.verdict)) {
    throw new Error("Invalid verdict shape");
  }
  return {
    verdict: p.verdict,
    confidence: Math.max(0, Math.min(100, Number(p.confidence) || 0)),
    supporting: Array.isArray(p.supporting) ? p.supporting.slice(0, 3) : [],
    risks: Array.isArray(p.risks) ? p.risks.slice(0, 3) : [],
    summary: typeof p.summary === "string" ? p.summary : "",
  };
}

export async function getVerdict(
  query: string,
  evidence: WireSourceResult[]
): Promise<Verdict> {
  const evidenceBlock = evidence
    .map((e) => `### ${e.service} (${e.ok ? "available" : "unavailable"})\n${e.summary}`)
    .join("\n\n");

  const sys = `You are a neutral analyst. Given web evidence about a product, return ONLY valid JSON:
{"verdict":"BUY"|"WAIT"|"SKIP","confidence":0-100,"supporting":["short","short","short"],"risks":["short","short","short"],"summary":"one sentence"}
Keep strings under 10 words. Return COMPLETE JSON, no markdown.`;

  const text = await callGroq(sys, `Topic: "${query}"\n\nEvidence:\n\n${evidenceBlock}\n\nJSON verdict:`);
  return validateVerdict(safeParseJSON(text));
}

export async function getComparison(
  queryA: string,
  evidenceA: WireSourceResult[],
  queryB: string,
  evidenceB: WireSourceResult[]
): Promise<CompareResult> {
  const fmt = (q: string, ev: WireSourceResult[]) =>
    ev.map((e) => `### ${e.service} (${e.ok ? "available" : "unavailable"})\n${e.summary}`).join("\n\n");

  const sys = `You are a neutral product comparison analyst. Given evidence for two products, return ONLY valid JSON:
{"productA":{"verdict":"BUY"|"WAIT"|"SKIP","confidence":0-100,"supporting":["short","short","short"],"risks":["short","short","short"],"summary":"one sentence"},"productB":{"verdict":"BUY"|"WAIT"|"SKIP","confidence":0-100,"supporting":["short","short","short"],"risks":["short","short","short"],"summary":"one sentence"},"winner":"A"|"B"|"TIE","reason":"one sentence why"}
Keep all strings under 10 words. Return COMPLETE JSON, no markdown.`;

  const msg = `Product A: "${queryA}"\nEvidence A:\n${fmt(queryA, evidenceA)}\n\nProduct B: "${queryB}"\nEvidence B:\n${fmt(queryB, evidenceB)}\n\nJSON comparison:`;

  const parsed = safeParseJSON(await callGroq(sys, msg));
  return {
    productA: validateVerdict(parsed.productA),
    productB: validateVerdict(parsed.productB),
    winner: ["A", "B", "TIE"].includes(parsed.winner) ? parsed.winner : "TIE",
    reason: typeof parsed.reason === "string" ? parsed.reason : "",
  };
}
