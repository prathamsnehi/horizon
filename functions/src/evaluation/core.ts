import { createHash, randomInt } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { writerQuestsSchema } from "../llm/schemas";
import { TransportationMode } from "../types";
import { bounds, Scenario, scenarios } from "./scenarios";

export interface Place {
  id: string; name: string; address: string; latitude: number; longitude: number;
  website: string; sourceURL: string;
}
export type WriterOutput = ReturnType<typeof writerQuestsSchema.parse>;
export interface Result {
  key: string; scenarioId: string; stage: "search" | "writer" | "pipeline" | "preflight";
  provider: string; model: string; split: string; repetition: number;
  ok: boolean; latencyMs: number; attempts: number; error?: string;
  failures: string[]; warnings: string[]; output?: WriterOutput;
  placeIds?: string[]; sourceURLs?: string[]; candidates?: number;
  inputHash?: string;
  promptVariant?: string;
}
export interface Checkpoint {
  version: 1; manifest: string; createdAt: string; native: Record<string, unknown>;
  results: Result[]; calls: Record<string, number>; frozen: boolean;
}

export function redact(value: string, secrets: string[] = []): string {
  let result = value;
  for (const secret of secrets.filter(Boolean)) result = result.split(secret).join("[REDACTED]");
  return result.replace(/AIza[\w-]{20,}/g, "[REDACTED]")
    .replace(/([?&](?:key|api_key|token)=)[^&\s"']+/gi, "$1[REDACTED]")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]");
}

export function normalizePlace(value: unknown): Place | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.name !== "string" || typeof row.address !== "string") return null;
  const name = row.name.trim(), address = row.address.trim();
  const latitude = row.latitude, longitude = row.longitude;
  if (!name || !address || typeof latitude !== "number" || typeof longitude !== "number" ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < bounds.south || latitude > bounds.north || longitude < bounds.west || longitude > bounds.east) return null;
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : `coordinate-${fingerprint({ name, address, latitude, longitude })}`;
  return { id, name, address, latitude, longitude,
    website: safeURL(row.website), sourceURL: safeURL(row.sourceURL) };
}
function safeURL(value: unknown): string {
  try {
    const url = new URL(String(value));
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return "";
    for (const key of [...url.searchParams.keys()]) if (/key|token|secret|credential/i.test(key)) url.searchParams.delete(key);
    return url.href;
  }
  catch { return ""; }
}

export function validateWriter(value: unknown, scenario: Scenario): { output?: WriterOutput; failures: string[]; warnings: string[] } {
  const parsed = writerQuestsSchema.safeParse(value);
  if (!parsed.success) {
    const missingLocation = parsed.error.issues.some(issue => issue.path.includes("assignedLocationId"));
    return { failures: ["invalid_schema", ...(missingLocation ? ["missing_location"] : [])], warnings: [] };
  }
  const failures: string[] = [], warnings: string[] = [];
  if (parsed.data.quests.length !== 1) failures.push("wrong_quest_count");
  for (const quest of parsed.data.quests) {
    if (quest.assignedLocationId !== "loc_0") failures.push("invalid_location_reference");
    if (!scenario.profile.transportation.includes(quest.recommendedTransportationMode as TransportationMode)) failures.push("invalid_transport");
    if (quest.estimatedActivityMinutes <= 0) failures.push("invalid_duration");
    if (![quest.title, quest.questDescription, quest.locationDescription].every(s => s.trim())) failures.push("empty_required_field");
    if (!quest.pushesComfortZoneEdges.every(s => scenario.profile.comfortZoneEdges.includes(s))) failures.push("invented_edge");
    if (quest.pushesComfortZoneEdges.length < 1 || quest.pushesComfortZoneEdges.length > 3) failures.push("invalid_edge_count");
    if (!quest.categories.length || quest.categories.some(s => !s.trim())) failures.push("missing_categories");
    const text = quest.questDescription + " " + quest.locationDescription;
    if (/wi-?fi|outlets?|quiet|silent|seating|open until|reservation|walk-in|accessible|free admission|\$\d/i.test(text)) warnings.push("venue_claim_needs_review");
    if (scenario.category === "coffee" && /strike up|introduce yourself|talk to a stranger|start a conversation/i.test(quest.questDescription)) warnings.push("deep_work_distraction_needs_review");
  }
  return { output: parsed.data, failures: [...new Set(failures)], warnings: [...new Set(warnings)] };
}

// Persist app-authored instructions, but replace source venue names/addresses.
// Raw provider content, coordinates, photos, and search payloads are not saved.
export function anonymizeOutput(output: WriterOutput, place: Place): WriterOutput {
  const copy = JSON.parse(JSON.stringify(output)) as WriterOutput;
  const replace = (text: string) => [place.address, place.name].filter(Boolean)
    .reduce((s, term) => s.split(term).join("[resolved venue]"), text);
  for (const quest of copy.quests) {
    quest.title = replace(quest.title); quest.questDescription = replace(quest.questDescription);
    quest.locationDescription = replace(quest.locationDescription);
  }
  return copy;
}
export const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
// SDK errors can include request bodies, provider responses, or prompts. Retain
// only a status/category, never arbitrary error text from generation providers.
export function providerError(error: unknown): string {
  const value = error as { statusCode?: number; status?: number; name?: string; message?: string };
  const status = value?.statusCode ?? value?.status;
  if (typeof status === "number") return `Provider HTTP ${status}`;
  if (/timeout|timed out/i.test(value?.message ?? "") || value?.name === "TimeoutError") return "Provider timeout";
  if (/context.*(exceed|limit)|exceed.*context/i.test(value?.message ?? "")) return "Native context limit exceeded";
  if (/guardrail/i.test(value?.message ?? "")) return "Native guardrail rejection";
  if (/rate.?limit/i.test(value?.message ?? "")) return "Provider rate limited";
  if (/refusal/i.test(value?.message ?? "")) return "Native model refusal";
  if (/network|connection|ECONNRESET/i.test(value?.message ?? "")) return "Provider networking failure";
  return "Provider operation failed (details suppressed)";
}
export function assertSameInput(previous: Result | undefined, inputHash: string): void {
  if (previous && previous.inputHash !== inputHash) throw new Error("Venue evidence changed while resuming; start a new output directory to avoid mixing inputs.");
}
export function scenarioKeys(scenario: Scenario): string[] {
  return [
    ...["cloud", "apple"].flatMap(p => [0, 1, 2].map(r => `${scenario.id}:writer:${p}:${r}`)),
    ...(scenario.pipeline ? ["google", "apple"].flatMap(p => ["cloud", "apple"].map(w => `${scenario.id}:pipeline:${p}+${w}:0`)) : []),
    `${scenario.id}:search:google`, `${scenario.id}:search:apple`,
  ];
}
export function tuningComplete(state: Checkpoint): boolean {
  const done = new Set(state.results.map(r => r.key));
  // Failure results are completed observations too; never hide them by retrying
  // permanent errors or generating replacement quests on resume.
  return scenarios.filter(s => s.split === "tuning").every(s => scenarioKeys(s).every(key => done.has(key)));
}
export async function saveCheckpoint(path: string, state: Checkpoint): Promise<void> {
  await writeFile(path + ".tmp", JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(path + ".tmp", path);
}
export async function loadCheckpoint(path: string, manifest: string): Promise<Checkpoint | null> {
  let raw: string;
  try { raw = await readFile(path, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  const state = JSON.parse(raw) as Checkpoint;
  if (state.version !== 1 || state.manifest !== manifest || !Array.isArray(state.results)) throw new Error("Checkpoint does not match scenarios, model, prompts, and native binary. Start a new output directory.");
  return state;
}
export function shuffled<T>(values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = randomInt(i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export function percentile(values: number[], fraction: number): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)];
}
export const isTransient = (error: unknown): boolean => {
  const e = error as { status?: number; statusCode?: number; name?: string; message?: string };
  const status = e.statusCode ?? e.status;
  return status === 429 || (status !== undefined && status >= 500) || e.name === "TimeoutError" ||
    /timeout|temporarily unavailable|rate.?limit|connection|network|fetch failed|ECONNRESET|EAI_AGAIN/i.test(e.message ?? "");
};
export async function attempt<T>(operation: () => Promise<T>, retryable: (error: unknown) => boolean = isTransient): Promise<{ value?: T; error?: unknown; attempts: number; latencyMs: number }> {
  const start = performance.now();
  for (let attempts = 1; attempts <= 2; attempts++) {
    try { return { value: await operation(), attempts, latencyMs: performance.now() - start }; }
    catch (error) {
      if (attempts === 2 || !retryable(error)) return { error, attempts, latencyMs: performance.now() - start };
    }
  }
  throw new Error("unreachable");
}
