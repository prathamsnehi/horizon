import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Checkpoint, percentile } from "./core";

export interface Review {
  id: string; requestFit: number; actionClarity: number; feasibility: number; challengeFit: number;
  criticalFailures: string[]; notes: string; sourceURLs?: string[];
}
export interface SearchReview {
  id: string; notes: string;
  candidates: Array<{ rank: number; relevance: number; activityEvidence: "verified" | "unknown" | "contradicted";
    criticalFailures: string[]; notes: string; sourceURLs?: string[] }>;
}
const criticalCategories = ["invented_venue_fact", "wrong_location", "missing_location"];
const validFailures = (values: unknown): boolean => Array.isArray(values) && values.every(v => criticalCategories.includes(v));
const validSources = (values: unknown): boolean => values === undefined || Array.isArray(values) && values.every(v => {
  try { const url = new URL(v); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && ![...url.searchParams.keys()].some(k => /key|secret|token/i.test(k)); }
  catch { return false; }
});

export async function writeReport(directory: string, state: Checkpoint): Promise<void> {
  let reviews: Review[] = [], mapping: Array<{ id: string; key: string }> = [];
  for (const name of ["reviews.json", "blind-key.json"]) {
    try {
      const value = JSON.parse(await readFile(resolve(directory, name), "utf8"));
      if (!Array.isArray(value)) throw new Error(`${name} must contain an array`);
      if (name === "reviews.json") reviews = value; else mapping = value;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  for (const review of reviews) {
    if (![review.requestFit, review.actionClarity, review.feasibility, review.challengeFit].every(n => Number.isInteger(n) && n >= 1 && n <= 5) ||
        !validFailures(review.criticalFailures) || typeof review.notes !== "string" || !review.notes.trim() || !validSources(review.sourceURLs) ||
        !mapping.some(m => m.id === review.id)) throw new Error("Invalid or unmatched review");
  }
  if (new Set(reviews.map(r => r.id)).size !== reviews.length) throw new Error("Duplicate review IDs");
  const reviewByKey = new Map(reviews.map(r => [mapping.find(m => m.id === r.id)!.key, r]));
  let searchReviews: SearchReview[] = [], searchMapping: Array<{ id: string; key: string }> = [];
  for (const name of ["search-reviews.json", "blind-search-key.json"]) {
    try {
      const value = JSON.parse(await readFile(resolve(directory, name), "utf8"));
      if (!Array.isArray(value)) throw new Error(`${name} must contain an array`);
      if (name === "search-reviews.json") searchReviews = value; else searchMapping = value;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  for (const review of searchReviews) {
    const result = state.results.find(r => r.key === searchMapping.find(m => m.id === review.id)?.key);
    if (!result || !Array.isArray(review.candidates) || review.candidates.length !== result.candidates ||
        typeof review.notes !== "string" || !review.notes.trim() || review.candidates.some((c, index) => c.rank !== index + 1 ||
          !Number.isInteger(c.relevance) || c.relevance < 1 || c.relevance > 5 || !["verified", "unknown", "contradicted"].includes(c.activityEvidence) ||
          !validFailures(c.criticalFailures) || typeof c.notes !== "string" || !c.notes.trim() || !validSources(c.sourceURLs) ||
          c.activityEvidence !== "unknown" && !c.sourceURLs?.length)) throw new Error("Invalid or unmatched search review; score every candidate and cite verified/contradicted activity evidence");
  }
  if (new Set(searchReviews.map(r => r.id)).size !== searchReviews.length) throw new Error("Duplicate search review IDs");
  const searchReviewByKey = new Map(searchReviews.map(r => [searchMapping.find(m => m.id === r.id)!.key, r]));
  const groups = [...new Set(state.results.map(r => `${r.stage}/${r.provider}/${r.split}`))];
  const rows = groups.map(group => {
    const results = state.results.filter(r => `${r.stage}/${r.provider}/${r.split}` === group);
    const scored = results.flatMap(r => { const review = reviewByKey.get(r.key); return review ? [review] : []; });
    const average = (name: keyof Review) => scored.length ? (scored.reduce((sum, r) => sum + Number(r[name]), 0) / scored.length).toFixed(2) : "unreviewed";
    return `| ${group} | ${results.length} | ${results.filter(r => r.ok).length} | ${scored.length} | ${average("requestFit")} | ${average("actionClarity")} | ${average("feasibility")} | ${average("challengeFit")} | ${scored.filter(r => r.criticalFailures.length).length} | ${Math.round(percentile(results.filter(r => r.attempts).map(r => r.latencyMs), .5) ?? 0)} | ${Math.round(percentile(results.filter(r => r.attempts).map(r => r.latencyMs), .95) ?? 0)} |`;
  });
  const failures: Record<string, number> = {};
  for (const result of state.results) for (const failure of result.failures) failures[failure] = (failures[failure] ?? 0) + 1;
  const qualityFailures: Record<string, number> = {};
  for (const review of reviews) for (const failure of review.criticalFailures) qualityFailures[failure] = (qualityFailures[failure] ?? 0) + 1;
  const pairedRows = [...new Set(state.results.filter(r => r.stage === "writer").map(r => r.scenarioId))].flatMap(scenarioId => {
    const averages = ["cloud", "apple"].map(provider => {
      const scored = state.results.filter(r => r.stage === "writer" && r.scenarioId === scenarioId && r.provider === provider)
        .flatMap(r => { const review = reviewByKey.get(r.key); return review ? [review] : []; });
      const total = scored.reduce((sum, r) => sum + (r.requestFit + r.actionClarity + r.feasibility + r.challengeFit) / 4, 0);
      return scored.length ? total / scored.length : undefined;
    });
    if (averages.some(n => n === undefined)) return [];
    return [`| ${scenarioId} | ${averages[0]!.toFixed(2)} | ${averages[1]!.toFixed(2)} | ${(averages[1]! - averages[0]!).toFixed(2)} |`];
  });
  const searchRows = [...new Set(state.results.filter(r => r.stage === "search").map(r => `${r.provider}/${r.split}`))].map(group => {
    const results = state.results.filter(r => r.stage === "search" && `${r.provider}/${r.split}` === group);
    const reviewed = results.flatMap(r => { const review = searchReviewByKey.get(r.key); return review ? [review] : []; });
    const candidates = reviewed.flatMap(r => r.candidates);
    const relevance = candidates.length ? (candidates.reduce((sum, c) => sum + c.relevance, 0) / candidates.length).toFixed(2) : "unreviewed";
    return `| ${group} | ${reviewed.length}/${results.length} | ${candidates.length} | ${relevance} | ${reviewed.filter(r => r.candidates.some(c => c.relevance >= 3)).length} | ${candidates.filter(c => c.activityEvidence === "verified").length} | ${candidates.filter(c => c.activityEvidence === "unknown").length} | ${candidates.filter(c => c.activityEvidence === "contradicted").length} | ${candidates.filter(c => c.criticalFailures.length).length} |`;
  });
  const exampleScenarios = [...new Set(state.results.filter(r => r.stage === "writer" && r.output && reviewByKey.has(r.key)).map(r => r.scenarioId))].slice(0, 6);
  const examples = state.results.filter(r => r.stage === "writer" && exampleScenarios.includes(r.scenarioId) && r.repetition === 0 && r.output && reviewByKey.has(r.key)).map(r => {
    const q = r.output!.quests[0], review = reviewByKey.get(r.key)!;
    return `**${r.scenarioId} · ${r.provider} · repetition ${r.repetition + 1}**\n\n${q.title}\n\n${q.questDescription}\n\nReviewer: ${review.notes}`;
  });
  const report = [
    "# Minneapolis quest-quality evaluation", `Started: ${state.createdAt}`, `Native environment: ${JSON.stringify(state.native)}`,
    "This is a Mac-native pilot, not an iPhone performance or worldwide coverage result. The cloud model is the repository's configured primary Writer; routing, cache hits, Scout generation, and generic fallbacks are excluded.",
    "## Measurements", "Valid means structural/reference checks passed. Search success means a normalized in-bounds place was returned, not that the activity is offered. Latency includes retries and Apple IPC overhead. No battery, thermal, or iPhone-performance inference is made.",
    ["| Stage/provider/split | Cases | Valid | Reviewed | Request fit | Clarity | Feasibility | Challenge fit | Reviewed critical failures | Median ms | P95 ms |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |", ...rows].join("\n"),
    "Provider calls (including retries and metadata):", "~~~json\n" + JSON.stringify(state.calls, null, 2) + "\n~~~",
    `Automatic failures: ${JSON.stringify(failures)}`, `Reviewed writing critical failure categories: ${JSON.stringify(qualityFailures)}`,
    "## Place relevance and activity evidence",
    "Relevance is scored for every returned candidate (up to five), separately from evidence that the requested activity is actually available. At least one relevant candidate means a relevance score of 3 or more. Only official-source evidence supports verified/contradicted activity labels.",
    searchRows.length ? ["| Provider/split | Searches reviewed | Candidates | Mean relevance | Searches with ≥1 relevant place | Activity verified | Unknown | Contradicted | Critical candidates |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |", ...searchRows].join("\n") : "No place-discovery scenarios completed.",
    "## Review method and limitations",
    reviews.length ? `Recorded ${reviews.length} provider-blinded qualitative judgments before reveal. This is one assistant reviewer's assessment, not an independent human panel.` : "Qualitative review has not been performed. No semantic quality conclusion is justified by schema success alone.",
    "Scores run from 1 (unusable), through 3 (usable with caveats), to 5 (excellent). Unknown amenities, hours, prices, accessibility, and event/class availability receive no credit and are not automatically failures. Unsupported assertions require review and direct venue sources for disputed claims.",
    "Canonical writing uses identical normalized Google venue facts for both models; the 2×2 pipeline uses each provider's top eligible place. This input choice may favor Google's coverage and is disclosed. Prompts freeze before held-out evaluation; all repetitions for a scenario share its split.",
    "Apple tuning uses the initial production task with guided generation and evidence boundaries. The single held-out adaptation removes the unrelated barista example, compacts identical venue evidence, and repeats existing allowed field values. It adds no venue facts or profile fields. Its frozen hash is recorded in the native environment metadata. Keep tuning and held-out Apple results separate; the cloud prompt remains unchanged.",
    "Three repetitions share one scenario and are not three independent users or venues. Score means cover reviewed outputs only; missing/failed generations remain in case and failure counts. This small synthetic pilot supports descriptive paired comparisons, not population-level significance claims.",
    "The reused cloud Writer prompt omits several profile fields, including budget and vibe; budget restrictions must appear in the explicit request to reach either Writer. Travel estimates are the app's distance-based estimates, not verified routes or transit schedules. Prompts/settings are controlled inputs; this comparison also includes the permitted Apple-specific adaptation, so it does not isolate model weights alone.",
    "## Recommendations", reviews.length ? "Component recommendations require the completed reviewer assessment and coverage checks; see the accompanying findings document. Do not promote a provider based only on valid counts." : "Place discovery: **expand testing**. Quest writing: **expand testing**. Await blinded review and venue suitability checks before changing architecture.",
    "## Paired writing scores", "Mean of the four rubric scores per scenario, averaged across available reviewed repetitions. Positive difference favors Apple. Interpret with validity/failure counts, split, and missing review coverage.",
    pairedRows.length ? ["| Scenario | Cloud | Apple | Apple minus cloud |", "| --- | ---: | ---: | ---: |", ...pairedRows].join("\n") : "No scored writing pairs are available.",
    "## Paired reviewed examples", examples.join("\n\n---\n\n") || "No paired generated outputs are available for review.", ""
  ].join("\n\n");
  await writeFile(resolve(directory, "report.md"), report, { mode: 0o600 });
}
