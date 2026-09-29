import assert from "node:assert/strict";
import test from "node:test";
import { lookupOtcSunscreenLabelCandidates } from "../supabase/functions/_shared/otc-sunscreen-label-candidates.ts";

const setId = "00280745-908b-468f-e063-6294a90aa12f";
const label = {
  id: "46425877-3cf0-6496-e063-6294a90acf37",
  set_id: setId,
  effective_time: "20251218",
  active_ingredient: ["Active ingredients Purpose Avobenzone 3.0% Sunscreen"],
  inactive_ingredient: ["Inactive ingredients water, glycerin, niacinamide"],
  purpose: ["Sunscreen"],
  openfda: {
    brand_name: ["Olay Regenerist SPF 15"],
    product_type: ["HUMAN OTC DRUG"],
    product_ndc: ["69423-719"],
    package_ndc: ["69423-719-75"],
  },
};

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

test("default OFF makes no network call, even with valid input", async () => {
  const result = await lookupOtcSunscreenLabelCandidates(
    { kind: "exact_brand_name", value: "Olay Regenerist SPF 15" },
    { apiKey: "test-key", fetcher: (() => { throw Error("must not fetch"); }) as typeof fetch },
  );
  assert.deepEqual(result, { status: "disabled", candidates: [] });
});

test("rejects UPC-as-NDC and unsafe name before fetching", async () => {
  const fetcher = (() => { throw Error("must not fetch"); }) as typeof fetch;
  for (const query of [
    { kind: "segmented_ndc" as const, value: "123456789012" },
    { kind: "exact_brand_name" as const, value: "Sunscreen\" OR *" },
  ]) {
    assert.deepEqual(await lookupOtcSunscreenLabelCandidates(query, { enabled: true, apiKey: "test-key", fetcher }),
      { status: "invalid_input", candidates: [] });
  }
});

test("requires a server-side openFDA key before live lookup", async () => {
  const result = await lookupOtcSunscreenLabelCandidates(
    { kind: "segmented_ndc", value: "69423-719-75" },
    { enabled: true, fetcher: (() => { throw Error("must not fetch"); }) as typeof fetch },
  );
  assert.deepEqual(result, { status: "configuration_required", candidates: [] });
});

test("exact brand lookup preserves raw active/inactive fields and cross-checks SPL version", async () => {
  const calls: URL[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(url);
    if (calls.length === 1) {
      assert.equal(url.origin, "https://api.fda.gov");
      assert.equal(url.searchParams.get("search"), 'openfda.brand_name.exact:"Olay Regenerist SPF 15"');
      assert.equal(url.searchParams.get("limit"), "3");
      assert.match(String(new Headers(init?.headers).get("authorization")), /^Basic /);
      assert.equal(init?.redirect, "error");
      return json({ meta: { results: { total: 1 } }, results: [label] });
    }
    assert.equal(url.origin, "https://dailymed.nlm.nih.gov");
    assert.equal(url.searchParams.get("setid"), setId);
    return json({ data: [{ setid: setId, spl_version: 3, published_date: "Dec 22, 2025" }] });
  }) as typeof fetch;
  const result = await lookupOtcSunscreenLabelCandidates(
    { kind: "exact_brand_name", value: "Olay Regenerist SPF 15" },
    { enabled: true, apiKey: "test-key", fetcher, now: () => new Date("2026-09-28T00:00:00Z") },
  );
  assert.equal(result.status, "candidates");
  if (result.status !== "candidates") return;
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.candidates[0]!.activeIngredientLabelText, label.active_ingredient);
  assert.deepEqual(result.candidates[0]!.inactiveIngredientLabelText, label.inactive_ingredient);
  assert.equal(result.candidates[0]!.dailyMed?.splVersion, 3);
  assert.match(result.candidates[0]!.sourceUrl, /^https:\/\/api\.fda\.gov\/drug\/label\.json\?/);
  assert.equal(result.candidates[0]!.fetchedAt, "2026-09-28T00:00:00.000Z");
  assert.equal(calls.length, 2);
});

test("segmented NDC lookup searches the exact NDC field; cannot turn label into formula truth", async () => {
  const fetcher = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.hostname === "api.fda.gov") {
      assert.equal(url.searchParams.get("search"), 'openfda.package_ndc.exact:"69423-719-75"');
      return json({ meta: { results: { total: 1 } }, results: [label] });
    }
    return json({ data: [] });
  }) as typeof fetch;
  const result = await lookupOtcSunscreenLabelCandidates(
    { kind: "segmented_ndc", value: "69423-719-75" }, { enabled: true, apiKey: "test-key", fetcher },
  );
  assert.equal(result.status, "candidates");
  if (result.status !== "candidates") return;
  assert.deepEqual(Object.keys(result.candidates[0]!).sort(), [
    "activeIngredientLabelText", "brandName", "effectiveTime", "fetchedAt", "inactiveIngredientLabelText",
    "packageNdcs", "productNdcs", "source", "sourceRecordId", "sourceUrl", "splSetId",
  ]);
});

test("wrong brand, non-OTC, and non-sunscreen records abstain", async () => {
  for (const changed of [
    { openfda: { ...label.openfda, brand_name: ["Different sunscreen"] } },
    { openfda: { ...label.openfda, product_type: ["HUMAN PRESCRIPTION DRUG"] } },
    { openfda: { ...label.openfda, brand_name: ["Olay Regenerist SPF 15"] }, purpose: ["Moisturizer"], active_ingredient: ["Water"] },
  ]) {
    const entry = { ...label, ...changed };
    // The third fixture still has SPF in its name but no actual sunscreen label claim.
    const result = await lookupOtcSunscreenLabelCandidates(
      { kind: "exact_brand_name", value: "Olay Regenerist SPF 15" },
      { enabled: true, apiKey: "test-key", fetcher: (async () => json({ results: [entry] })) as typeof fetch },
    );
    assert.deepEqual(result, { status: "no_match", candidates: [] });
  }
});

test("ambiguous/truncated search never performs DailyMed cross-check", async () => {
  let calls = 0;
  const result = await lookupOtcSunscreenLabelCandidates(
    { kind: "exact_brand_name", value: "Olay Regenerist SPF 15" },
    { enabled: true, apiKey: "test-key", fetcher: (async () => {
      calls++;
      return json({ meta: { results: { total: 10 } }, results: [label] });
    }) as typeof fetch },
  );
  assert.equal(result.status, "candidates");
  if (result.status !== "candidates") return;
  assert.equal(result.truncated, true);
  assert.equal(result.candidates[0]!.dailyMed, undefined);
  assert.equal(calls, 1);
});

test("404 is no-match; malformed, oversized, and failure responses fail closed", async () => {
  const query = { kind: "exact_brand_name" as const, value: "Olay Regenerist SPF 15" };
  const base = { enabled: true, apiKey: "test-key" };
  assert.equal((await lookupOtcSunscreenLabelCandidates(query,
    { ...base, fetcher: (async () => json({ error: "not found" }, 404)) as typeof fetch })).status, "no_match");
  for (const response of [
    json({ error: "unavailable" }, 503),
    new Response("not json", { status: 200 }),
    new Response("x".repeat(512 * 1024 + 1), { status: 200 }),
  ]) {
    assert.equal((await lookupOtcSunscreenLabelCandidates(query,
      { ...base, fetcher: (async () => response) as typeof fetch })).status, "provider_error");
  }
});
