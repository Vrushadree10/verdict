/**
 * lib/wire.ts
 * Thin wrapper around the Anakin Wire API (internally named "Holocron").
 *
 * Real API contract (confirmed against anakin.io/docs/api-reference/holocron,
 * June 2026):
 *   GET  /v1/holocron/catalog            -> every website with action_count
 *   GET  /v1/holocron/catalog/{slug}      -> one site's full action list + schemas
 *   GET  /v1/holocron/search?q=...        -> search actions across all catalogs
 *   POST /v1/holocron/task                -> { action_id, params } -> 202 { job_id }
 *   GET  /v1/holocron/jobs/{id}           -> poll until status is completed/failed
 *
 * Tasks are ASYNC: submitting a task returns a job_id, not data. You must poll
 * the job endpoint until status is "completed" (data is in `data`) or "failed".
 * A few actions run in "sync" mode and may return `data` directly on submit —
 * this client handles both.
 *
 * IMPORTANT — before this app returns real data, run:
 *   npm run check-catalog
 * That script searches the live catalog for amazon/reddit/google-trends
 * actions and prints their real action_id + parameter schema. Update
 * WIRE_ACTIONS below to match — the action_ids here are placeholders.
 *
 * The app degrades gracefully: if an action_id is wrong or a source requires
 * auth you haven't connected, that one source fails and Claude still
 * synthesizes a verdict from whatever sources succeeded.
 */

const BASE = "https://api.anakin.io/v1/holocron";

export type WireSourceResult = {
  service: string;
  ok: boolean;
  summary: string; // plain-text digest fed to Claude
  raw?: unknown;
};

type ActionConfig = {
  service: string;
  label: string;
  action_id: string;
  buildParams: (query: string) => Record<string, unknown>;
  /** Turn the raw Wire response into a short plain-text digest for Claude. */
  summarize: (data: unknown) => string;
};

// ---- EDIT THESE after running `npm run check-catalog` -------------------
// action_id values below are PLACEHOLDERS. Real Holocron action_ids tend to
// follow a short-prefix convention (e.g. Airbnb's are "ab_...", LinkedIn's
// are "li_..."), so these exact strings are very likely wrong — that's what
// check-catalog.mjs is for.
export const WIRE_ACTIONS: ActionConfig[] = [
  {
    service: "amazon",
    label: "Amazon — price & rating",
    action_id: "am_search_products", // TODO verify against catalog
    buildParams: (query) => ({ query }),
    summarize: (data) => safeDigest(data, "No Amazon listing data returned."),
  },
  {
    service: "reddit",
    label: "Reddit — real discussion",
    action_id: "rd_search_posts", // TODO verify against catalog
    buildParams: (query) => ({ query }),
    summarize: (data) => safeDigest(data, "No Reddit discussion data returned."),
  },
  {
    service: "google_trends",
    label: "Google Trends — interest over time",
    action_id: "gt_search", // TODO verify against catalog
    buildParams: (query) => ({ keyword: query }),
    summarize: (data) => safeDigest(data, "No Google Trends data returned."),
  },
];
// ---------------------------------------------------------------------------

function safeDigest(data: unknown, fallback: string): string {
  if (!data) return fallback;
  try {
    const json = JSON.stringify(data);
    // Trim hard so we don't blow up the Claude prompt with huge payloads.
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
    const hint = json?.error?.connect_url
      ? ` (connect this account at https://anakin.io${json.error.connect_url})`
      : "";
    throw new Error(`Wire task "${action_id}" rejected: ${code} ${message}${hint}`);
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

  // Some actions run in "sync" mode and return data inline on submit.
  if (submitted.data !== undefined) return submitted.data;
  if (submitted.job_id) return await pollJob(submitted.job_id, apiKey);

  throw new Error(`Unexpected Wire response shape for "${action_id}"`);
}

/** List every catalog (site) Wire supports — used by the check-catalog script. */
export async function listCatalogs() {
  const apiKey = apiKeyOrThrow();
  const res = await fetch(`${BASE}/catalog`, { headers: { "X-API-Key": apiKey } });
  if (!res.ok) throw new Error(`List catalogs failed: ${res.status}`);
  return res.json();
}

/** Fetch one catalog's full action list + JSON-schema params — used by check-catalog. */
export async function fetchCatalog(slug: string) {
  const apiKey = apiKeyOrThrow();
  const res = await fetch(`${BASE}/catalog/${slug}`, { headers: { "X-API-Key": apiKey } });
  if (!res.ok) throw new Error(`Catalog lookup for "${slug}" failed: ${res.status}`);
  return res.json();
}

/** Search actions across every catalog by free text — used by check-catalog. */
export async function searchActions(q: string) {
  const apiKey = apiKeyOrThrow();
  const url = new URL(`${BASE}/search`);
  url.searchParams.set("q", q);
  const res = await fetch(url, { headers: { "X-API-Key": apiKey } });
  if (!res.ok) throw new Error(`Search actions failed: ${res.status}`);
  return res.json();
}

/** Run all configured Wire actions in parallel; failures degrade to ok:false rather than throwing. */
export async function gatherEvidence(query: string): Promise<WireSourceResult[]> {
  const results = await Promise.all(
    WIRE_ACTIONS.map(async (action) => {
      try {
        const data = await wireTask(action.action_id, action.buildParams(query));
        return {
          service: action.label,
          ok: true,
          summary: action.summarize(data),
          raw: data,
        } satisfies WireSourceResult;
      } catch (err) {
        return {
          service: action.label,
          ok: false,
          summary: `Source unavailable (${err instanceof Error ? err.message : "unknown error"})`,
        } satisfies WireSourceResult;
      }
    })
  );
  return results;
}
