const BASE = "https://api.anakin.io/v1/wire";

export type WireSourceResult = {
  service: string;
  ok: boolean;
  summary: string;
  raw?: unknown;
};

type ActionConfig = {
  service: string;
  label: string;
  action_id: string;
  buildParams: (query: string) => Record<string, unknown>;
  summarize: (data: unknown) => string;
};

export const WIRE_ACTIONS: ActionConfig[] = [
  {
    service: "amazon",
    label: "Amazon — price & rating",
    action_id: "am_search_products",
    buildParams: (query) => ({ query }),
    summarize: (data) => safeDigest(data, "No Amazon listing data returned."),
  },
  {
    service: "reddit",
    label: "Reddit — real discussion",
    action_id: "rt_search",
    buildParams: (query) => ({ query }),
    summarize: (data) => safeDigest(data, "No Reddit discussion data returned."),
  },
  {
    service: "google_trends",
    label: "Google Trends — interest over time",
    action_id: "gt_interest_over_time",
    buildParams: (query) => ({ keyword: query }),
    summarize: (data) => safeDigest(data, "No Google Trends data returned."),
  },
];

function safeDigest(data: unknown, fallback: string): string {
  if (!data) return fallback;
  try {
    const json = JSON.stringify(data);
    return json.length > 1800 ? json.slice(0, 1800) + " …(truncated)" : json;
  } catch {
    return fallback;
  }
}

function apiKeyOrThrow(): string {
  const apiKey = process.env.ANAKIN_API_KEY;
  if (!apiKey) throw new Error("ANAKIN_API_KEY is not set");
  return apiKey;
}

async function submitTask(action_id: string, params: Record<string, unknown>, apiKey: string) {
  const res = await fetch(`${BASE}/task`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ action_id, params }),
    signal: AbortSignal.timeout(15_000),
  });

  const json: any = await res.json().catch(() => ({}));

  if (!res.ok && res.status !== 202) {
    const code = json?.error?.code ?? res.status;
    const message = json?.error?.message ?? res.statusText;
    throw new Error(`Wire task "${action_id}" rejected: ${code} ${message}`);
  }

  return json as { status: string; job_id?: string; data?: unknown; error?: any };
}

async function pollJob(
  jobId: string,
  apiKey: string,
  { intervalMs = 3000, timeoutMs = 45000 } = {}
): Promise<unknown> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE}/jobs/${jobId}`, {
      headers: { "X-API-Key": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    const json: any = await res.json().catch(() => ({}));
    if (json.status === "completed") return json.data;
    if (json.status === "failed") {
      throw new Error(`Wire job ${jobId} failed: ${json?.error?.message ?? "unknown error"}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Wire job ${jobId} timed out after ${timeoutMs}ms`);
}

async function wireTask(action_id: string, params: Record<string, unknown>): Promise<unknown> {
  const apiKey = apiKeyOrThrow();
  const submitted = await submitTask(action_id, params, apiKey);
  if (submitted.data !== undefined) return submitted.data;
  if (submitted.job_id) return await pollJob(submitted.job_id, apiKey);
  throw new Error(`Unexpected Wire response shape for "${action_id}"`);
}

export async function fetchCatalog(slug: string) {
  const apiKey = apiKeyOrThrow();
  const res = await fetch(`${BASE}/catalog/${slug}`, { headers: { "X-API-Key": apiKey } });
  if (!res.ok) throw new Error(`Catalog lookup for "${slug}" failed: ${res.status}`);
  return res.json();
}

export async function gatherEvidence(query: string): Promise<WireSourceResult[]> {
  const results = await Promise.all(
    WIRE_ACTIONS.map(async (action) => {
      try {
        const data = await wireTask(action.action_id, action.buildParams(query));
        return { service: action.label, ok: true, summary: action.summarize(data), raw: data } satisfies WireSourceResult;
      } catch (err) {
        return { service: action.label, ok: false, summary: `Source unavailable (${err instanceof Error ? err.message : "unknown error"})` } satisfies WireSourceResult;
      }
    })
  );
  return results;
}