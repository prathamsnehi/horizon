import { execFile, spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import { promisify } from "node:util";
import { createInterface } from "node:readline";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { generateText, Output } from "ai";
import { createLunaModel, LUNA_MODEL, providerOptions, COMPLETION_TOKEN_CAP, ATTEMPT_TIMEOUT_MS } from "../llm/client";
import { writerQuestsSchema } from "../llm/schemas";
import { buildQuestWriterPrompt } from "../utils/prompts";
import { calculateAllTransportOptions, calculateDistanceMiles } from "../utils/distance";
import { bounds, scenarios, Scenario } from "./scenarios";
import { anonymizeOutput, assertSameInput, attempt, Checkpoint, fingerprint, loadCheckpoint, normalizePlace, Place,
  providerError, redact, Result, saveCheckpoint, scenarioKeys, tuningComplete, validateWriter } from "./core";
import { writeReport } from "./report";
import { SearchEvidence, writeBlindArtifacts } from "./review";
import { appleHeldoutVariant, buildAppleWriterPrompt, freezeApplePrompt } from "./applePrompt";

const execute = promisify(execFile);
const adaptationVersion = "apple-evidence-boundary-v1";

class NativeBridge {
  private child?: ChildProcessWithoutNullStreams;
  private pending?: { resolve: (value: any) => void; reject: (error: Error) => void };
  constructor(private binary: string) {}
  async call(request: Record<string, unknown>): Promise<any> {
    if (!this.child || this.child.exitCode !== null || this.child.killed) {
      this.child = spawn(this.binary, [], { stdio: "pipe" });
      const child = this.child;
      // SDK diagnostics never enter artifacts or user-visible logs.
      this.child.stderr.on("data", () => {});
      this.child.stdin.on("error", () => { if (this.child === child) this.pending?.reject(new Error("Native harness input failed")); });
      createInterface({ input: this.child.stdout }).on("line", line => {
        if (this.child !== child) return;
        const pending = this.pending;
        if (!pending) return;
        this.pending = undefined;
        try {
          const response = JSON.parse(line);
          if (!response.ok) throw new Error(response.error ?? "Native operation failed");
          pending.resolve(response.value);
        } catch (error) { pending.reject(error as Error); }
      });
      this.child.on("error", () => { if (this.child === child) this.pending?.reject(new Error("Native harness could not launch")); });
      this.child.on("exit", () => { if (this.child === child) this.pending?.reject(new Error("Native harness exited")); });
    }
    if (this.pending) throw new Error("Concurrent native requests are prohibited");
    return new Promise((accept, reject) => {
      const timer = setTimeout(() => {
        this.pending = undefined; this.child?.kill(); reject(new Error("Native request timeout"));
      }, 120_000);
      this.pending = { resolve: value => { clearTimeout(timer); accept(value); },
        reject: error => { clearTimeout(timer); this.pending = undefined; reject(error); } };
      this.child!.stdin.write(JSON.stringify(request) + "\n");
    });
  }
  close(): void { this.child?.stdin.end(); this.child?.kill(); }
}

async function readSecret(name: string, version = "latest"): Promise<string> {
  try {
    const preload = resolve(__dirname, "../../evaluation/firebase-memory-only.cjs");
    const cliEnvironment: NodeJS.ProcessEnv = { ...process.env, NODE_OPTIONS: `--require=${JSON.stringify(preload)}` };
    // Debug console logs would contaminate captured secret output. The preload
    // separately disables Firebase's default on-disk debug transport.
    delete cliEnvironment.DEBUG;
    const result = await execute("firebase", ["functions:secrets:access", `${name}@${version}`, "--project", "horizon-sidequests", "--non-interactive"],
      { timeout: 60_000, maxBuffer: 128_000, env: cliEnvironment });
    if (!result.stderr.includes("HORIZON_EVAL_FILE_LOGGER_DISABLED")) throw new Error("Unable to suppress CLI file logging");
    const key = result.stdout.trim();
    // Do not assume a legacy Google key prefix: current credentials may use
    // another format. Provider preflight establishes validity, not this parser.
    if (!key || key.length > 2048 || /\s/.test(key)) throw new Error("invalid secret response");
    return key;
  } catch { throw new Error(`Unable to read ${name} through Firebase CLI with file logging disabled. Check CLI compatibility, authentication, and Secret Manager access; secret output suppressed.`); }
}

async function httpJSON(url: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    // Provider bodies can contain credentials or request input. Record status only.
    const error = new Error(`Provider HTTP ${response.status}`) as Error & { status: number };
    error.status = response.status; throw error;
  }
  return response.json();
}

function venueInput(place: Place, scenario: Scenario): Record<string, unknown> {
  const distance = calculateDistanceMiles(scenario.profile.cityLatitude!, scenario.profile.cityLongitude!, place.latitude, place.longitude);
  return { id: "loc_0", name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude,
    locationDescription: "", distanceMiles: distance,
    transportationOptions: calculateAllTransportOptions(distance, scenario.profile.transportation) };
}

export async function runEvaluation(args = process.argv.slice(2), cloudIntervalMs = 5000): Promise<void> {
  if (Number(process.versions.node.split(".")[0]) !== 22) throw new Error("Use Node 22 for this benchmark.");
  const option = (name: string, fallback: string) => {
    const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1] ?? fallback;
  };
  let nextCloudAt = 0;
  const paceCloud = async () => {
    const wait = Math.max(0, nextCloudAt - Date.now());
    if (wait) await delay(wait);
    nextCloudAt = Date.now() + cloudIntervalMs;
  };
  const command = args[0] ?? "run";
  if (!["run", "report", "purge"].includes(command)) throw new Error("Use run, report, or purge.");
  const outputDirectory = resolve(option("--out", "../.evaluation-results/minneapolis"));
  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  const checkpointPath = resolve(outputDirectory, "checkpoint.json");
  if (command === "report") {
    const state = JSON.parse(await readFile(checkpointPath, "utf8")) as Checkpoint;
    await writeReport(outputDirectory, state); return;
  }
  if (command === "purge") {
    const state = JSON.parse(await readFile(checkpointPath, "utf8")) as Checkpoint;
    await rm(resolve(tmpdir(), `horizon-venue-review-${state.manifest}.json`), { force: true });
    await rm(resolve(tmpdir(), `horizon-blind-search-review-${state.manifest}.json`), { force: true });
    await rm(resolve(tmpdir(), `horizon-blind-writer-evidence-${state.manifest}.json`), { force: true });
    console.log("Temporary normalized venue review deleted; app-authored results preserved."); return;
  }
  const binary = resolve(option("--native", "/private/tmp/horizon-native-eval"));
  const primary = { providerId: "tokenrouter", modelId: LUNA_MODEL, providerOptions: providerOptions("tokenrouter") };
  const phaseOption = option("--phase", "all");
  if (!["all", "tuning", "heldout"].includes(phaseOption)) throw new Error("Invalid phase");
  const limit = Number(option("--limit", "30"));
  if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw new Error("Limit must be an integer from 1 to 30");
  const tokenrouterSecretVersion = option("--tokenrouter-secret-version", "latest");
  if (tokenrouterSecretVersion !== "latest" && !/^[1-9]\d*$/.test(tokenrouterSecretVersion)) throw new Error("Secret version must be latest or a positive integer");
  const dependencies = fingerprint(await readFile(resolve(__dirname, "../../yarn.lock")));
  const manifest = fingerprint({ scenarios, bounds, primary, tokenrouterSecretVersion, dependencies,
    cloudLimits: { completionTokens: COMPLETION_TOKEN_CAP, attemptTimeoutMs: ATTEMPT_TIMEOUT_MS, cloudIntervalMs }, prompt: buildQuestWriterPrompt.toString(), adaptationVersion,
    nativeBinary: fingerprint(await readFile(binary)) });
  let state = await loadCheckpoint(checkpointPath, manifest);
  if (!state) state = { version: 1, manifest, createdAt: new Date().toISOString(), native: {}, results: [], calls: {}, frozen: false };
  const checkpoint = state;
  const applePromptHash = fingerprint(buildAppleWriterPrompt.toString());
  if (checkpoint.frozen) freezeApplePrompt(checkpoint, applePromptHash);
  if (phaseOption === "heldout" && !tuningComplete(checkpoint)) throw new Error("Finish all ten tuning scenarios before freezing prompts and running held-out scenarios.");
  const venueReviewPath = resolve(tmpdir(), `horizon-venue-review-${manifest}.json`);
  let venueReviews: SearchEvidence[] = [];
  try { venueReviews = JSON.parse(await readFile(venueReviewPath, "utf8")).scenarios ?? []; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const native = new NativeBridge(binary);
  const secrets: string[] = [];
  const save = () => saveCheckpoint(checkpointPath, checkpoint);
  const counted = async <T>(name: string, fn: () => Promise<T>) => {
    checkpoint.calls[name] = (checkpoint.calls[name] ?? 0) + 1;
    await save(); return fn();
  };
  const done = (key: string) => checkpoint.results.some(r => r.key === key);
  const record = async (result: Result) => { checkpoint.results.push(result); await save(); };
  const blindArtifacts = () => writeBlindArtifacts(outputDirectory, checkpoint, venueReviews,
    resolve(tmpdir(), `horizon-blind-search-review-${manifest}.json`));
  try {
    console.log("Preflight: credentials stay in memory; no Firebase callable or database writes.");
    const placesKey = await readSecret("PLACES_API_KEY"); secrets.push(placesKey);
    const tokenrouterKey = await readSecret("TOKENROUTER_API_KEY", tokenrouterSecretVersion); secrets.push(tokenrouterKey);
    const environment = await native.call({ operation: "availability" });
    if (checkpoint.native.os && checkpoint.native.os !== environment.os) throw new Error("Native OS changed while resuming; start a new output directory.");
    checkpoint.native = { ...checkpoint.native, ...environment };
    if (!checkpoint.native.available) throw new Error(`Native model unavailable: ${String(checkpoint.native.availability)}`);
    const metadata = await attempt(() => counted("cloud.metadata", () => httpJSON("https://api.tokenrouter.com/v1/models", {
      headers: { Authorization: `Bearer ${tokenrouterKey}` },
    })));
    checkpoint.native.cloudModel = primary.modelId;
    checkpoint.native.nodeVersion = process.versions.node;
    checkpoint.native.dependencyLockHash = dependencies;
    checkpoint.native.appleSettings = { temperature: 0.3, maximumResponseTokens: 1200, adaptationVersion };
    checkpoint.native.cloudSettings = { temperature: "provider default", providerOptions: primary.providerOptions ?? {}, SDKRetries: 0, maxOutputTokens: COMPLETION_TOKEN_CAP, attemptTimeoutMs: ATTEMPT_TIMEOUT_MS, minimumStartIntervalMs: cloudIntervalMs };
    if (metadata.value) {
      const model = metadata.value.data?.find((entry: { id: string }) => entry.id === LUNA_MODEL);
      if (!model) metadata.error = new Error("Configured Luna model is unavailable in the catalog");
      const version = model?.version ?? "not disclosed";
      if (checkpoint.native.cloudVersion && checkpoint.native.cloudVersion !== version) throw new Error("Cloud model version changed while resuming; start a new output directory.");
      checkpoint.native.cloudVersion = version;
      checkpoint.native.cloudModelName = LUNA_MODEL;
    }
    checkpoint.native.tokenrouterSecretVersion = tokenrouterSecretVersion;
    const preflightFailures: string[] = [];
    const preflightRun = async (provider: string, model: string, result: Awaited<ReturnType<typeof attempt>>, candidates?: number) => {
      const ok = !result.error;
      const error = result.error ? providerError(result.error) : undefined;
      if (!ok) preflightFailures.push(`${provider}: ${error}`);
      await record({ key: `preflight:${provider}:${checkpoint.results.filter(r => r.stage === "preflight").length}`,
        scenarioId: "preflight", stage: "preflight", provider, model, split: "preflight", repetition: 0,
        ok, latencyMs: result.latencyMs, attempts: result.attempts, error, failures: ok ? [] : ["preflight_failed"], warnings: [], candidates });
    };
    await preflightRun("cloud", primary.modelId, metadata);
    // Test each service independently, even if another fails. Preflight probes
    // are excluded from all quality scores and do not generate evaluated quests.
    const googleProbe = await attempt(() => counted("google.preflight", () => httpJSON("https://places.googleapis.com/v1/places:searchText", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": placesKey,
        "X-Goog-FieldMask": "places.id" }, body: JSON.stringify({ textQuery: scenarios[0].query, maxResultCount: 1,
        locationRestriction: { rectangle: { low: { latitude: bounds.south, longitude: bounds.west }, high: { latitude: bounds.north, longitude: bounds.east } } } }) })));
    await preflightRun("google", "Places API New", googleProbe, googleProbe.value?.places?.length);
    const nativeSearch = await attempt(() => counted("apple.preflight.search", () => native.call({ operation: "search", query: scenarios[0].query, ...bounds })));
    await preflightRun("apple.search", "MKLocalSearch", nativeSearch, nativeSearch.value?.length);
    const nativeGeneration = await attempt(() => counted("apple.preflight.write", () => native.call({ operation: "probe" })));
    if (!nativeGeneration.error && nativeGeneration.value?.ready !== true) nativeGeneration.error = new Error("Native probe returned invalid output");
    await preflightRun("apple.write", "SystemLanguageModel.default", nativeGeneration);
    await save();
    if (preflightFailures.length) throw new Error(`Evaluation preflight blocked: ${preflightFailures.join("; ")}. No model substitution performed.`);
    await rm(resolve(outputDirectory, "blocker.txt"), { force: true });
    const luna = createLunaModel(tokenrouterKey);
    const phases = [scenarios.filter(s => s.split === "tuning"), scenarios.filter(s => s.split === "heldout")];
    let processed = 0;
    for (let phase = 0; phase < phases.length; phase++) {
      if (phaseOption === "tuning" && phase === 1 || phaseOption === "heldout" && phase === 0) continue;
      if (processed >= limit) break;
      if (phase === 1) {
        if (!tuningComplete(checkpoint)) throw new Error("Finish all ten tuning scenarios before freezing prompts and running held-out scenarios.");
        freezeApplePrompt(checkpoint, applePromptHash); await save();
      }
      for (const scenario of phases[phase]) {
        if (processed >= limit) break;
        if (scenarioKeys(scenario).every(done)) continue;
        processed++;
        console.log(`${scenario.id} (${scenario.split}): search + paired writing`);
        const venues: Record<string, Place[]> = {};
        for (const provider of ["google", "apple"]) {
          const key = `${scenario.id}:search:${provider}`;
          const response = await attempt(() => counted(provider === "google" ? "google.search" : "apple.search", async () => {
            if (provider === "apple") return native.call({ operation: "search", query: scenario.query, ...bounds });
            const body = await httpJSON("https://places.googleapis.com/v1/places:searchText", {
              method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": placesKey,
                "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.businessStatus,places.websiteUri,places.googleMapsUri" },
              body: JSON.stringify({ textQuery: scenario.query, languageCode: "en", maxResultCount: 10,
                locationRestriction: { rectangle: { low: { latitude: bounds.south, longitude: bounds.west }, high: { latitude: bounds.north, longitude: bounds.east } } } }) });
            return (body.places ?? []).filter((p: any) => !["CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"].includes(p.businessStatus))
              .map((p: any) => ({ id: p.id, name: p.displayName?.text, address: p.formattedAddress,
                latitude: p.location?.latitude, longitude: p.location?.longitude, website: p.websiteUri ?? "", sourceURL: p.googleMapsUri ?? "" }));
          }));
          venues[provider] = (response.value ?? []).map(normalizePlace).filter((p: Place | null): p is Place => p !== null).slice(0, 5);
          const places = venues[provider];
          const inputHash = fingerprint(places);
          const previousSearch = checkpoint.results.find(r => r.key === key);
          if (previousSearch) assertSameInput(previousSearch, inputHash);
          venueReviews = venueReviews.filter(r => !(r.scenarioId === scenario.id && r.provider === provider));
          venueReviews.push({ scenarioId: scenario.id, provider, query: scenario.query, intent: scenario.intent, places });
          if (!done(key)) await record({ key, scenarioId: scenario.id, stage: "search", provider, model: provider === "google" ? "Places API New" : "MKLocalSearch",
            split: scenario.split, repetition: 0, ok: !response.error && places.length > 0, attempts: response.attempts, latencyMs: response.latencyMs,
            error: response.error ? providerError(response.error) : undefined, failures: response.error ? ["search_failed", "unresolved_location"] : places.length ? [] : ["unresolved_location"], warnings: ["activity_suitability_requires_review"],
            inputHash, placeIds: places.map(p => p.id), sourceURLs: places.flatMap(p => [p.website, p.sourceURL]).filter(Boolean), candidates: places.length });
        }
        // Only normalized review evidence, never raw API responses or photos.
        // This temporary file must be purged after direct-source verification.
        await writeFile(venueReviewPath, JSON.stringify({ expiresAt: new Date(Date.now() + 86_400_000).toISOString(), scenarios: venueReviews }, null, 2), { mode: 0o600 });
        // Canonical Writer inputs use the same Google venue for both models. If
        // Google cannot resolve one, both fail; never silently switch providers.
        const compose = async (stage: "writer" | "pipeline", provider: "cloud" | "apple", placeProvider: string, repetition: number) => {
          const label = stage === "writer" ? provider : `${placeProvider}+${provider}`;
          const key = `${scenario.id}:${stage}:${label}:${repetition}`;
          if (done(key)) return;
          const place = venues[placeProvider][0];
          const previous = checkpoint.results.find(r => r.scenarioId === scenario.id && r.stage === stage && r.provider === label && r.placeIds?.length);
          const inputHash = fingerprint({ place, profile: scenario.profile, intent: scenario.intent });
          if (place) assertSameInput(previous, inputHash);
          const base: Result = { key, scenarioId: scenario.id, stage, provider: label,
            model: provider === "cloud" ? primary.modelId : "SystemLanguageModel.default", split: scenario.split, repetition,
            promptVariant: provider === "cloud" ? "production-writer" : scenario.split === "tuning" ? "initial-production-task-with-evidence-boundary" : appleHeldoutVariant,
            ok: false, attempts: 0, latencyMs: 0, failures: [], warnings: [], inputHash, placeIds: place ? [place.id] : [], sourceURLs: place ? [place.website, place.sourceURL].filter(Boolean) : [] };
          if (!place) { base.failures = ["unresolved_location"]; await record(base); return; }
          const venue = venueInput(place, scenario);
          const baselinePrompt = buildQuestWriterPrompt(scenario.profile, [venue], scenario.intent);
          const prompt = provider === "apple" && scenario.split === "heldout" ? buildAppleWriterPrompt(baselinePrompt, scenario, venue) : baselinePrompt;
          if (provider === "cloud") await paceCloud();
          const result = await attempt(() => counted(provider === "cloud" ? "cloud.write" : "apple.write", async () => {
            if (provider === "apple") return native.call({ operation: "write", prompt });
            const generated = await generateText({ model: luna, output: Output.object({ schema: writerQuestsSchema }),
              prompt, providerOptions: primary.providerOptions, maxOutputTokens: COMPLETION_TOKEN_CAP,
              maxRetries: 0, abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) });
            return generated.output;
          }), provider === "cloud" ? () => false : undefined);
          base.attempts = result.attempts; base.latencyMs = result.latencyMs;
          if (result.error) { base.error = providerError(result.error); base.failures = ["generation_failed"]; }
          else {
            const checked = validateWriter(result.value, scenario);
            base.failures = checked.failures; base.warnings = checked.warnings; base.ok = !checked.failures.length;
            if (checked.output) base.output = anonymizeOutput(checked.output, place);
          }
          await record(base);
        };
        for (let repetition = 0; repetition < 3; repetition++) for (const provider of ["cloud", "apple"] as const) await compose("writer", provider, "google", repetition);
        if (scenario.pipeline) for (const placeProvider of ["google", "apple"]) for (const provider of ["cloud", "apple"] as const) await compose("pipeline", provider, placeProvider, 0);
      }
    }
    await blindArtifacts();
    await writeReport(outputDirectory, checkpoint);
    console.log(`Saved ${checkpoint.results.length} results. Review blind-review.json before inspecting blind-key.json.`);
    console.log(`Temporary blinded search cards: ${resolve(tmpdir(), `horizon-blind-search-review-${manifest}.json`)}`);
  } catch (error) {
    const message = redact(String(error), secrets);
    await writeFile(resolve(outputDirectory, "blocker.txt"), message + "\n", { mode: 0o600 });
    await save(); await blindArtifacts(); await writeReport(outputDirectory, checkpoint); throw new Error(message);
  } finally { native.close(); }
}

if (require.main === module) runEvaluation().catch(error => { console.error(String(error)); process.exitCode = 1; });
