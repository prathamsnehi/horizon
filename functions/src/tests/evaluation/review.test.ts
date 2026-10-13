import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Checkpoint, Result } from "../../evaluation/core";
import { writeReport } from "../../evaluation/report";
import { extendBlindKey, SearchEvidence, writeBlindArtifacts } from "../../evaluation/review";
import { scenarios } from "../../evaluation/scenarios";

const scenario = scenarios[0];
const place = { id: "provider-id", name: "Fixture Café", address: "Fixture Address", latitude: 44.98, longitude: -93.26,
  website: "https://example.org/", sourceURL: "https://maps.apple.com/?ll=44.98,-93.26" };
const quest = { title: "Focus", questDescription: "Write for 25 minutes at [resolved venue].", locationDescription: "A café.",
  difficulty: "easy" as const, estimatedActivityMinutes: 25, categories: ["coffee"], assignedLocationId: "loc_0",
  recommendedTransportationMode: "walking" as const, pushesComfortZoneEdges: scenario.profile.comfortZoneEdges };
const results: Result[] = [
  { key: `${scenario.id}:writer:apple:0`, stage: "writer", placeIds: ["canonical-id"], output: { quests: [quest] } },
  { key: `${scenario.id}:search:apple`, stage: "search", candidates: 1 },
].map(row => ({ scenarioId: scenario.id, provider: "apple", model: "fixture", split: "tuning", repetition: 0,
  ok: true, attempts: 1, latencyMs: 100, failures: [], warnings: [], ...row })) as Result[];
const state: Checkpoint = { version: 1, manifest: "fixture", createdAt: "fixture", native: { os: "fixture" },
  results, calls: { "apple.write": 1, "apple.search": 1 }, frozen: false };
const evidence: SearchEvidence[] = [
  { scenarioId: scenario.id, provider: "apple", query: scenario.query, intent: scenario.intent, places: [place] },
  { scenarioId: scenario.id, provider: "google", query: scenario.query, intent: scenario.intent, places: [{ ...place, id: "canonical-id", name: "Canonical Café" }] },
];

test("blind keys append without changing existing judgments and reject stale/duplicate keys", () => {
  const first = extendBlindKey([], ["cloud", "apple"], "Q");
  expect(first.map(v => v.key).sort()).toEqual(["apple", "cloud"]);
  const next = extendBlindKey(first, ["cloud", "apple", "new"], "Q");
  expect(next.slice(0, 2)).toEqual(first); expect(next[2]).toEqual({ id: "Q003", key: "new" });
  expect(() => extendBlindKey(first, ["changed"], "Q")).toThrow("stale");
  expect(() => extendBlindKey([first[0], first[0]], ["apple", "cloud"], "Q")).toThrow("Invalid");
});

test("review artifacts hide provider labels and keep source identities only in temporary search cards", async () => {
  const directory = await mkdtemp(join(tmpdir(), "horizon-blind-test-"));
  try {
    const searchPath = join(directory, "temporary-search.json");
    await writeBlindArtifacts(directory, state, evidence, searchPath);
    const writer = await readFile(join(directory, "blind-review.json"), "utf8");
    const search = await readFile(searchPath, "utf8");
    expect(writer).not.toMatch(/apple|cloud|provider-id|Fixture Address|maps\.apple/i);
    expect(search).not.toMatch(/apple|provider-id|maps\.apple/i);
    expect(search).toContain("Fixture Café");
    expect(JSON.parse(search).cards[0].candidates[0].websiteLink).toBe(place.website);
    const supplied = await readFile(join(directory, "horizon-blind-writer-evidence-fixture.json"), "utf8");
    expect(JSON.parse(supplied).cards[0].suppliedVenue.name).toBe("Canonical Café");
    expect(supplied).not.toMatch(/apple|google|canonical-id|provider-id/i);
    await writeBlindArtifacts(directory, state, evidence, searchPath);
    expect(await readFile(join(directory, "blind-review.json"), "utf8")).toBe(writer);
    await writeReport(directory, state);
    expect(await readFile(join(directory, "report.md"), "utf8")).toContain("Qualitative review has not been performed");
    await writeFile(join(directory, "reviews.json"), JSON.stringify([{ id: "Q001", requestFit: 5, actionClarity: 4,
      feasibility: 3, challengeFit: 4, criticalFailures: [], notes: "Preserves focused work; amenities unknown." }]));
    await writeFile(join(directory, "search-reviews.json"), JSON.stringify([{ id: "S001", notes: "Café identity relevant; suitability unknown.",
      candidates: [{ rank: 1, relevance: 4, activityEvidence: "unknown", criticalFailures: [], notes: "No amenity evidence." }] }]));
    await writeReport(directory, state);
    expect(await readFile(join(directory, "report.md"), "utf8")).toContain("5.00");
    await writeFile(join(directory, "search-reviews.json"), JSON.stringify([{ id: "S001", notes: "Unproven claim.",
      candidates: [{ rank: 1, relevance: 4, activityEvidence: "verified", criticalFailures: [], notes: "No source." }] }]));
    await expect(writeReport(directory, state)).rejects.toThrow("cite");
    await writeFile(join(directory, "search-reviews.json"), "[]");
    await writeFile(join(directory, "reviews.json"), JSON.stringify([{ id: "Q001", requestFit: 6, actionClarity: 4,
      feasibility: 3, challengeFit: 4, criticalFailures: [], notes: "Invalid score." }]));
    await expect(writeReport(directory, state)).rejects.toThrow("Invalid");
  } finally { await rm(directory, { recursive: true }); }
});
