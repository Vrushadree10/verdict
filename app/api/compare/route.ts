import { NextRequest, NextResponse } from "next/server";
import { gatherEvidence } from "@/lib/wire";
import { getComparison } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: NextRequest) {
  let queryA: string, queryB: string;
  try {
    const body = await req.json();
    queryA = String(body?.queryA ?? "").trim();
    queryB = String(body?.queryB ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!queryA || !queryB || queryA.length > 200 || queryB.length > 200) {
    return NextResponse.json({ error: "Provide two product names (1-200 chars each)." }, { status: 400 });
  }

  try {
    const [evidenceA, evidenceB] = await Promise.all([
      gatherEvidence(queryA),
      gatherEvidence(queryB),
    ]);
    const comparison = await getComparison(queryA, evidenceA, queryB, evidenceB);

    return NextResponse.json({
      queryA,
      queryB,
      sourcesA: evidenceA.map((e) => ({ service: e.service, ok: e.ok })),
      sourcesB: evidenceB.map((e) => ({ service: e.service, ok: e.ok })),
      comparison,
    });
  } catch (err) {
    console.error("compare route error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Something went wrong." },
      { status: 500 }
    );
  }
}
