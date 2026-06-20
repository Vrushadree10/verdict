import { NextRequest, NextResponse } from "next/server";
import { gatherEvidence } from "@/lib/wire";
import { getVerdict } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let query: string;
  try {
    const body = await req.json();
    query = String(body?.query ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!query || query.length > 200) {
    return NextResponse.json({ error: "Provide a topic or product name (1-200 chars)." }, { status: 400 });
  }

  try {
    const evidence = await gatherEvidence(query);
    const verdict = await getVerdict(query, evidence);

    return NextResponse.json({
      query,
      sources: evidence.map((e) => ({ service: e.service, ok: e.ok })),
      verdict,
    });
  } catch (err) {
    console.error("verdict route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong." },
      { status: 500 }
    );
  }
}
