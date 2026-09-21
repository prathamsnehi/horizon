import {
  LLM_STAGES,
  TIMED_STAGES,
  spanAttemptLog,
  spanMetaBool,
  spanMetaString,
  spanOutputBool,
  type GenerationSample,
  type TraceOutcome,
} from "../types";

/**
 * Pure aggregation over a window of samples. No Firestore, no React — every
 * number the dashboard shows is derived here so it can be unit-tested against
 * fixtures, including the awkward cases (an empty window, a `rate_limited`
 * sample that never reached the pipeline and so has no stage spans).
 */

/** Nearest-rank percentile. Returns null for an empty set rather than 0, so
 *  "no data" is never rendered as a real measurement of zero. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/** A proportion plus the counts behind it — the UI shows both, because "100%"
 *  over two samples means something very different from 100% over two hundred. */
export interface Ratio {
  value: number | null;
  hits: number;
  total: number;
}

function ratio(hits: number, total: number): Ratio {
  return { value: total === 0 ? null : hits / total, hits, total };
}

export interface StageLatency {
  stage: string;
  count: number;
  p50: number | null;
  p95: number | null;
}

export interface TimeBucket {
  /** Epoch ms at the start of the bucket. */
  start: number;
  total: number;
  errors: number;
}

export interface ProviderUsage {
  key: string; // "gemini / gemini-3.5-flash"
  provider: string;
  model: string;
  count: number;
}

export interface DashboardStats {
  total: number;
  byOutcome: Record<TraceOutcome, number>;
  successRate: Ratio;
  errorCount: number;

  totalLatencyP50: number | null;
  totalLatencyP95: number | null;

  /** Share of curated requests served from the pre-generation cache. */
  cacheHitRate: Ratio;
  /** Share of Maps lookups that resolved a real place. Below ~50% the Scout
   *  prompt is the suspect, not Maps — see docs/backend/architecture.md. */
  mapsResolutionRate: Ratio;
  /** Share of pipeline runs that needed location-free quests to fill a deficit. */
  genericFallbackRate: Ratio;
  /** Share of LLM calls that took more than one provider attempt. */
  failoverRate: Ratio;

  stageLatencies: StageLatency[];
  buckets: TimeBucket[];
  providers: ProviderUsage[];
  recentErrors: GenerationSample[];
}

const EMPTY_OUTCOMES: Record<TraceOutcome, number> = {
  success: 0,
  error: 0,
  rate_limited: 0,
  invalid: 0,
  blocked: 0,
};

function spansNamed(sample: GenerationSample, stage: string) {
  return (sample.spans ?? []).filter((s) => s.stage === stage);
}

/**
 * @param samples  the window, in any order
 * @param now      window end, so bucketing is deterministic in tests
 * @param windowMs how far back the window reaches
 */
export function computeStats(
  samples: GenerationSample[],
  now: number,
  windowMs: number,
  bucketCount = 24
): DashboardStats {
  const byOutcome = { ...EMPTY_OUTCOMES };
  for (const s of samples) {
    if (s.outcome in byOutcome) byOutcome[s.outcome] += 1;
  }

  // --- latency -----------------------------------------------------------
  // Only completed pipelines carry a meaningful total; a request rejected at
  // validation or by the rate limiter would drag the distribution toward zero
  // and make the app look faster than it is.
  const completed = samples.filter(
    (s) => s.outcome === "success" || s.outcome === "error"
  );
  const totals = completed.map((s) => s.totalLatencyMs).filter((n) => typeof n === "number");

  const stageLatencies: StageLatency[] = TIMED_STAGES.map((stage) => {
    const values = samples.flatMap((s) => spansNamed(s, stage).map((sp) => sp.latencyMs));
    return {
      stage,
      count: values.length,
      p50: percentile(values, 50),
      p95: percentile(values, 95),
    };
  });

  // --- pipeline health ---------------------------------------------------
  let cacheHits = 0;
  let cacheLookups = 0;
  let mapsHits = 0;
  let mapsLookups = 0;
  let genericRuns = 0;
  let pipelineRuns = 0;
  let llmCalls = 0;
  let llmFailovers = 0;
  const providerCounts = new Map<string, ProviderUsage>();

  for (const sample of samples) {
    for (const span of spansNamed(sample, "cache.lookup")) {
      cacheLookups += 1;
      if (spanOutputBool(span, "hit")) cacheHits += 1;
    }

    for (const span of spansNamed(sample, "maps.resolve")) {
      mapsLookups += 1;
      if (spanMetaBool(span, "hit")) mapsHits += 1;
    }

    // A "pipeline run" is any sample that actually asked a model for quests —
    // the denominator for how often the generic fallback was needed.
    const ranPipeline = spansNamed(sample, "scout").length > 0;
    if (ranPipeline) {
      pipelineRuns += 1;
      if (spansNamed(sample, "generic").length > 0) genericRuns += 1;
    }

    for (const stage of LLM_STAGES) {
      for (const span of spansNamed(sample, stage)) {
        llmCalls += 1;
        if (spanAttemptLog(span).length > 1) llmFailovers += 1;

        const provider = spanMetaString(span, "provider");
        const model = spanMetaString(span, "model");
        if (provider && model) {
          const key = `${provider} / ${model}`;
          const existing = providerCounts.get(key);
          if (existing) existing.count += 1;
          else providerCounts.set(key, { key, provider, model, count: 1 });
        }
      }
    }
  }

  // --- volume over time --------------------------------------------------
  const bucketMs = Math.max(1, Math.floor(windowMs / bucketCount));
  const windowStart = now - windowMs;
  const buckets: TimeBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    start: windowStart + i * bucketMs,
    total: 0,
    errors: 0,
  }));
  for (const sample of samples) {
    const index = Math.floor((sample.startedAt - windowStart) / bucketMs);
    if (index < 0 || index >= buckets.length) continue;
    buckets[index].total += 1;
    if (sample.outcome === "error") buckets[index].errors += 1;
  }

  const recentErrors = samples
    .filter((s) => s.outcome === "error")
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 10);

  return {
    total: samples.length,
    byOutcome,
    successRate: ratio(byOutcome.success, completed.length),
    errorCount: byOutcome.error,

    totalLatencyP50: percentile(totals, 50),
    totalLatencyP95: percentile(totals, 95),

    cacheHitRate: ratio(cacheHits, cacheLookups),
    mapsResolutionRate: ratio(mapsHits, mapsLookups),
    genericFallbackRate: ratio(genericRuns, pipelineRuns),
    failoverRate: ratio(llmFailovers, llmCalls),

    stageLatencies,
    buckets,
    providers: [...providerCounts.values()].sort((a, b) => b.count - a.count),
    recentErrors,
  };
}

/** The stage whose span carries the failure, for one-line error summaries. */
export function failingStage(sample: GenerationSample): string | undefined {
  const failed = (sample.spans ?? []).find((s) => spanMetaBool(s, "ok") === false);
  if (failed) return failed.stage;
  const spans = sample.spans ?? [];
  return spans.length > 0 ? spans[spans.length - 1].stage : undefined;
}
