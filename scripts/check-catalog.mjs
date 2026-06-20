/**
 * scripts/check-catalog.mjs
 * Run with: npm run check-catalog
 * (loads .env.local automatically via Node's --env-file flag in package.json)
 *
 * Searches Wire's live catalog for amazon / reddit / google-trends actions
 * and prints their real action_id + parameter schema, so you can fix the
 * placeholders in lib/wire.ts before the app goes live.
 */

const BASE = "https://api.anakin.io/v1/holocron";
const QUERIES = ["amazon", "reddit", "google trends"];

const apiKey = process.env.ANAKIN_API_KEY;
if (!apiKey) {
  console.error("Missing ANAKIN_API_KEY — add it to .env.local first.");
  process.exit(1);
}

function printResult(r) {
  console.log(`  action_id: ${r.action_id}`);
  console.log(`    name:        ${r.name}`);
  console.log(`    catalog:     ${r.catalog_slug} (${r.catalog_name})`);
  console.log(`    mode:        ${r.mode}`);
  console.log(`    auth needed: ${r.auth_required}`);
  console.log(`    credits:     ${r.credits}`);
  const required = r.params?.required ?? [];
  const props = Object.keys(r.params?.properties ?? {});
  console.log(`    params:      ${props.join(", ") || "(none)"}  (required: ${required.join(", ") || "none"})`);
  console.log("");
}

for (const q of QUERIES) {
  console.log(`\n=== search: "${q}" ===`);
  try {
    const url = new URL(`${BASE}/search`);
    url.searchParams.set("q", q);
    const res = await fetch(url, { headers: { "X-API-Key": apiKey } });
    if (!res.ok) {
      console.log(`  request failed: ${res.status} ${res.statusText}`);
      continue;
    }
    const { results } = await res.json();
    if (!results?.length) {
      console.log("  no matches — try GET /v1/holocron/catalog to browse all sites by slug.");
      continue;
    }
    for (const r of results.slice(0, 8)) printResult(r);
  } catch (err) {
    console.log(`  error: ${err.message}`);
  }
}

console.log(
  "If a service above didn't return useful matches, also try:\n" +
  "  GET https://api.anakin.io/v1/holocron/catalog          (list every site + slug)\n" +
  "  GET https://api.anakin.io/v1/holocron/catalog/{slug}   (that site's full action list)\n" +
  "Or just browse https://anakin.io/wire in the dashboard — same data, visually.\n\n" +
  "Once you've picked the right action_id for amazon / reddit / google trends,\n" +
  "update WIRE_ACTIONS in lib/wire.ts: set action_id, and make buildParams()\n" +
  "build a params object matching that action's required schema fields exactly."
);
