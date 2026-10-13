import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { anonymizeOutput, assertSameInput, attempt, Checkpoint, fingerprint, loadCheckpoint, normalizePlace, percentile, providerError, redact, saveCheckpoint, scenarioKeys, tuningComplete, validateWriter } from "../../evaluation/core";
import { scenarios } from "../../evaluation/scenarios";

const place = { id: "fixture-id", name: "Fixture Café", address: "Fixture Address", latitude: 44.98, longitude: -93.26, website: "https://example.org/", sourceURL: "" };
const output = () => ({ quests: [{ title: "Write at Fixture Café", questDescription: "Spend 25 minutes writing at Fixture Café at Fixture Address.",
  difficulty: "easy", estimatedActivityMinutes: 25, categories: ["coffee"], assignedLocationId: "loc_0",
  recommendedTransportationMode: "walking", locationDescription: "A café.", pushesComfortZoneEdges: scenarios[0].profile.comfortZoneEdges }] });

test("suite has requested categories, split and held-out pipeline subset", () => {
  expect(scenarios).toHaveLength(30); expect(new Set(scenarios.map(s => s.id)).size).toBe(30);
  expect(scenarios.filter(s => s.category === "coffee")).toHaveLength(15);
  expect(scenarios.filter(s => s.category === "park")).toHaveLength(5);
  expect(scenarios.filter(s => s.category === "art")).toHaveLength(4);
  expect(scenarios.filter(s => s.category === "beginner")).toHaveLength(3);
  expect(scenarios.filter(s => s.category === "social")).toHaveLength(3);
  expect(scenarios.filter(s => s.split === "tuning")).toHaveLength(10);
  expect(scenarios.filter(s => s.pipeline)).toHaveLength(10);
  expect(scenarios.filter(s => s.pipeline).every(s => s.split === "heldout")).toBe(true);
});
test("rejects missing identity, invalid or out-of-bounds coordinates and unsafe URLs", () => {
  expect(normalizePlace(place)).toEqual(place);
  expect(normalizePlace({ ...place, name: "" })).toBeNull();
  expect(normalizePlace({ ...place, name: { invalid: "name" } })).toBeNull();
  expect(normalizePlace({ ...place, id: "" })?.id).toMatch(/^coordinate-/);
  expect(normalizePlace({ ...place, latitude: NaN })).toBeNull();
  expect(normalizePlace({ ...place, longitude: 0 })).toBeNull();
  expect(normalizePlace({ ...place, website: "javascript:alert(1)" })?.website).toBe("");
  expect(normalizePlace({ ...place, website: "https://example.org/?key=private&view=1" })?.website).toBe("https://example.org/?view=1");
  expect(normalizePlace({ ...place, website: "https://user:password@example.org/" })?.website).toBe("");
});
test("validates schema, location, transport, duration and exact edge references", () => {
  expect(validateWriter(output(), scenarios[0]).failures).toEqual([]);
  const invalid = output(); invalid.quests[0].assignedLocationId = "invented_place";
  invalid.quests[0].recommendedTransportationMode = "car";
  invalid.quests[0].estimatedActivityMinutes = 0; invalid.quests[0].pushesComfortZoneEdges = ["invented edge"];
  expect(validateWriter(invalid, scenarios[0]).failures).toEqual(expect.arrayContaining(["invalid_location_reference", "invalid_transport", "invalid_duration", "invented_edge"]));
  expect(validateWriter({}, scenarios[0]).failures).toEqual(["invalid_schema"]);
  const missing: any = output(); delete missing.quests[0].assignedLocationId;
  expect(validateWriter(missing, scenarios[0]).failures).toContain("missing_location");
});
test("claims are review flags rather than automatic truth labels", () => {
  const value = output(); value.quests[0].questDescription = "Confirm Wi-Fi before visiting.";
  expect(validateWriter(value, scenarios[0]).failures).toEqual([]);
  expect(validateWriter(value, scenarios[0]).warnings).toContain("venue_claim_needs_review");
});
test("redacts credentials, query keys, bearer tokens and source identity", () => {
  expect(redact("secret-key https://host/?key=abc&x=1 Bearer abc", ["secret-key"])).not.toMatch(/secret-key|key=abc|Bearer abc/);
  const anonymous = anonymizeOutput(validateWriter(output(), scenarios[0]).output!, place);
  expect(JSON.stringify(anonymous)).not.toMatch(/Fixture Café|Fixture Address/);
  expect(output().quests[0].title).toContain("Fixture Café");
});
test("transient failures retry once and permanent failures do not", async () => {
  let calls = 0;
  const recovered = await attempt(async () => { if (++calls === 1) throw Object.assign(new Error("busy"), { status: 503 }); return 42; });
  expect(recovered.value).toBe(42); expect(recovered.attempts).toBe(2);
  const failed = await attempt(async () => { throw Object.assign(new Error("forbidden"), { status: 403 }); });
  expect(failed.attempts).toBe(1);
  const exhausted = await attempt(async () => { throw Object.assign(new Error("busy"), { status: 429 }); });
  expect(exhausted.attempts).toBe(2);
  const network = await attempt(async () => { throw new Error("fetch failed"); });
  expect(network.attempts).toBe(2);
});
test("checkpoint survives restart and rejects changed or corrupt experiments", async () => {
  const directory = await mkdtemp(join(tmpdir(), "horizon-eval-test-"));
  try {
    const path = join(directory, "state.json"), manifest = fingerprint({ suite: 1 });
    const state: Checkpoint = { version: 1, manifest, createdAt: "fixture", native: {}, results: [], calls: { "google.search": 2 }, frozen: false };
    expect(await loadCheckpoint(path, manifest)).toBeNull(); await saveCheckpoint(path, state);
    expect(await loadCheckpoint(path, manifest)).toEqual(state);
    expect(JSON.parse(await readFile(path, "utf8")).calls["google.search"]).toBe(2);
    await expect(loadCheckpoint(path, "changed")).rejects.toThrow("does not match");
    await writeFile(path, "broken"); await expect(loadCheckpoint(path, manifest)).rejects.toThrow();
  } finally { await rm(directory, { recursive: true }); }
});
test("percentiles handle measured and empty samples", () => {
  expect(percentile([], .5)).toBeNull(); expect(percentile([40, 10, 20, 30], .5)).toBe(20);
  expect(percentile([40, 10, 20, 30], .95)).toBe(40);
});
test("SDK failure messages cannot persist prompts, credentials, or raw responses", () => {
  expect(providerError(Object.assign(new Error("fixture-secret-key raw provider body"), { statusCode: 403 }))).toBe("Provider HTTP 403");
  expect(providerError(new Error("fixture-secret-key raw prompt"))).toBe("Provider operation failed (details suppressed)");
  expect(providerError(new Error("request timeout: raw response"))).toBe("Provider timeout");
});
test("resume rejects altered venue evidence, even with an unchanged place identifier", () => {
  const prior = { inputHash: fingerprint(place) } as any;
  expect(() => assertSameInput(prior, fingerprint(place))).not.toThrow();
  expect(() => assertSameInput(prior, fingerprint({ ...place, address: "Different Address" }))).toThrow("evidence changed");
});
test("held-out evaluation requires all tuning observations, including recorded failures", () => {
  const state: Checkpoint = { version: 1, manifest: "fixture", createdAt: "fixture", native: {}, results: [], calls: {}, frozen: false };
  expect(tuningComplete(state)).toBe(false);
  state.results = scenarios.filter(s => s.split === "tuning").flatMap(s => scenarioKeys(s).map(key => ({ key, ok: false } as any)));
  expect(tuningComplete(state)).toBe(true);
  state.results.pop(); expect(tuningComplete(state)).toBe(false);
  expect(scenarioKeys(scenarios.find(s => s.pipeline)!)).toHaveLength(12);
});
