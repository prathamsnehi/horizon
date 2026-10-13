import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Checkpoint, Place, shuffled } from "./core";
import { scenarios } from "./scenarios";

export interface BlindKey { id: string; key: string }
export interface SearchEvidence {
  scenarioId: string; provider: string; query: string; intent: string; places: Place[];
}
export function extendBlindKey(existing: BlindKey[], keys: string[], prefix: string): BlindKey[] {
  if (new Set(existing.map(m => m.id)).size !== existing.length || new Set(existing.map(m => m.key)).size !== existing.length ||
      existing.some(m => !keys.includes(m.key))) throw new Error("Invalid or stale blind review key");
  const known = new Set(existing.map(m => m.key));
  return [...existing, ...shuffled(keys.filter(key => !known.has(key)))
    .map((key, index) => ({ id: `${prefix}${String(existing.length + index + 1).padStart(3, "0")}`, key }))];
}

async function readKey(path: string): Promise<BlindKey[]> {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    if (!Array.isArray(value)) throw new Error("Blind key must contain an array");
    return value;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
}

export async function writeBlindArtifacts(directory: string, state: Checkpoint, evidence: SearchEvidence[], searchReviewPath: string): Promise<void> {
  const writerResults = state.results.filter(r => r.output);
  const writerKeyPath = resolve(directory, "blind-key.json");
  const writerKey = extendBlindKey(await readKey(writerKeyPath), writerResults.map(r => r.key), "Q");
  const writerCards = writerKey.map(m => {
    const result = writerResults.find(r => r.key === m.key)!;
    const scenario = scenarios.find(s => s.id === result.scenarioId)!;
    return { id: m.id, scenarioId: scenario.id, intent: scenario.intent, profile: scenario.profile,
      evidence: "Only venue identity/address/coordinates supplied. Amenities, hours, prices, admission, class and event availability are UNKNOWN.",
      output: result.output };
  });
  await writeFile(writerKeyPath, JSON.stringify(writerKey, null, 2), { mode: 0o600 });
  await writeFile(resolve(directory, "blind-review.json"), JSON.stringify(writerCards, null, 2), { mode: 0o600 });
  // Review the supplied identity separately from generated prose: otherwise a
  // masked venue could conceal a neighborhood error in a pipeline comparison.
  const writerEvidence = writerKey.map(m => {
    const result = writerResults.find(r => r.key === m.key)!;
    const provider = result.stage === "writer" ? "google" : result.provider.split("+")[0];
    const venue = evidence.find(e => e.scenarioId === result.scenarioId && e.provider === provider);
    const place = venue?.places.find(p => result.placeIds?.includes(p.id));
    return { id: m.id, scenarioId: result.scenarioId, suppliedVenue: place ? {
      name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude,
    } : null };
  });
  await writeFile(resolve(dirname(searchReviewPath), `horizon-blind-writer-evidence-${state.manifest}.json`),
    JSON.stringify({ expiresAt: new Date(Date.now() + 86_400_000).toISOString(), cards: writerEvidence }, null, 2), { mode: 0o600 });

  const searchResults = state.results.filter(r => r.stage === "search");
  const searchKeyPath = resolve(directory, "blind-search-key.json");
  const searchKey = extendBlindKey(await readKey(searchKeyPath), searchResults.map(r => r.key), "S");
  const searchCards = searchKey.map(m => {
    const result = searchResults.find(r => r.key === m.key)!;
    const scenario = scenarios.find(s => s.id === result.scenarioId)!;
    const venue = evidence.find(r => r.scenarioId === scenario.id && r.provider === result.provider);
    return { id: m.id, scenarioId: scenario.id, query: scenario.query, intent: scenario.intent,
      evidenceAvailable: Boolean(venue),
      candidates: venue?.places.map((place, index) => ({ rank: index + 1, name: place.name, address: place.address,
        latitude: place.latitude, longitude: place.longitude, websiteLink: place.website })) ?? [] };
  });
  await writeFile(searchKeyPath, JSON.stringify(searchKey, null, 2), { mode: 0o600 });
  // Source identities and coordinates are temporary. Maps links/provider IDs
  // are deliberately omitted from blinded cards, but retained in the key/result.
  await writeFile(searchReviewPath, JSON.stringify({ expiresAt: new Date(Date.now() + 86_400_000).toISOString(), cards: searchCards }, null, 2), { mode: 0o600 });
}
