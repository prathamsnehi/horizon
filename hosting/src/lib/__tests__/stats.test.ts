import { describe, it, expect } from "vitest";
import { computeStats, percentile, failingStage } from "../stats";
import type { GenerationSample, TraceSpan } from "../../types";

const NOW = 1_760_000_000_000;
const HOUR = 60 * 60 * 1000;

function span(stage: string, extra: Partial<TraceSpan> = {}): TraceSpan {
  return { seq: 1, stage, offsetMs: 0, latencyMs: 100, ...extra };
}

function sample(over: Partial<GenerationSample> = {}): GenerationSample {
  return {
    id: "x",
    traceId: "t",
    type: "curated",
    startedAt: NOW - HOUR,
    totalLatencyMs: 1000,
    outcome: "success",
    spans: [],
    ...over,
  };
}

describe("percentile", () => {
  it("returns null for an empty set rather than a misleading zero", () => {
    expect(percentile([], 50)).toBeNull();
  });

  it("uses nearest-rank", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([1, 2, 3, 4, 5], 95)).toBe(5);
    expect(percentile([10], 95)).toBe(10);
  });

  it("does not mutate its input", () => {
    const values = [3, 1, 2];
    percentile(values, 50);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("computeStats — empty window", () => {
  const stats = computeStats([], NOW, 24 * HOUR);

  it("reports zero total without dividing by zero", () => {
    expect(stats.total).toBe(0);
    expect(stats.errorCount).toBe(0);
  });

  it("returns null ratios, not 0%, when nothing was measured", () => {
    expect(stats.successRate.value).toBeNull();
    expect(stats.mapsResolutionRate.value).toBeNull();
    expect(stats.cacheHitRate.value).toBeNull();
    expect(stats.genericFallbackRate.value).toBeNull();
    expect(stats.failoverRate.value).toBeNull();
    expect(stats.totalLatencyP50).toBeNull();
  });

  it("still emits a full set of empty buckets", () => {
    expect(stats.buckets).toHaveLength(24);
    expect(stats.buckets.every((b) => b.total === 0)).toBe(true);
  });
});

describe("computeStats — outcomes and latency", () => {
  it("excludes gated requests from the latency distribution", () => {
    // A rate-limited request returns in ~5ms and never runs the pipeline;
    // counting it would make the app look far faster than it is.
    const stats = computeStats(
      [
        sample({ totalLatencyMs: 1000 }),
        sample({ totalLatencyMs: 2000 }),
        sample({ outcome: "rate_limited", totalLatencyMs: 5 }),
      ],
      NOW,
      24 * HOUR
    );
    expect(stats.totalLatencyP50).toBe(1000);
    expect(stats.totalLatencyP95).toBe(2000);
  });

  it("measures success against completed runs, not against everything", () => {
    const stats = computeStats(
      [
        sample(),
        sample({ outcome: "error" }),
        sample({ outcome: "rate_limited" }),
        sample({ outcome: "invalid" }),
      ],
      NOW,
      24 * HOUR
    );
    expect(stats.total).toBe(4);
    expect(stats.successRate).toMatchObject({ hits: 1, total: 2, value: 0.5 });
    expect(stats.byOutcome.rate_limited).toBe(1);
    expect(stats.byOutcome.invalid).toBe(1);
  });
});

describe("computeStats — pipeline health", () => {
  it("derives maps resolution from span meta", () => {
    const stats = computeStats(
      [
        sample({
          spans: [
            span("maps.resolve", { meta: { hit: true } }),
            span("maps.resolve", { meta: { hit: false } }),
            span("maps.resolve", { meta: { hit: true } }),
          ],
        }),
      ],
      NOW,
      24 * HOUR
    );
    expect(stats.mapsResolutionRate).toMatchObject({ hits: 2, total: 3 });
  });

  it("derives cache hits from span output", () => {
    const stats = computeStats(
      [
        sample({ spans: [span("cache.lookup", { output: { hit: true } })] }),
        sample({ spans: [span("cache.lookup", { output: { hit: false } })] }),
      ],
      NOW,
      24 * HOUR
    );
    expect(stats.cacheHitRate.value).toBe(0.5);
  });

  it("counts generic fallback only against runs that reached the pipeline", () => {
    const stats = computeStats(
      [
        sample({ spans: [span("scout"), span("generic")] }),
        sample({ spans: [span("scout")] }),
        // Never reached Scout — must not land in the denominator.
        sample({ outcome: "invalid", spans: [span("request")] }),
      ],
      NOW,
      24 * HOUR
    );
    expect(stats.genericFallbackRate).toMatchObject({ hits: 1, total: 2 });
  });

  it("counts a failover only when more than one provider was tried", () => {
    const stats = computeStats(
      [
        sample({
          spans: [
            span("scout", { meta: { attemptLog: [{ ok: true }] } }),
            span("writer", {
              meta: { attemptLog: [{ ok: false }, { ok: true }] },
            }),
          ],
        }),
      ],
      NOW,
      24 * HOUR
    );
    expect(stats.failoverRate).toMatchObject({ hits: 1, total: 2 });
  });

  it("tallies provider usage by provider+model, most used first", () => {
    const withModel = (provider: string, model: string) =>
      span("writer", { meta: { provider, model } });
    const stats = computeStats(
      [
        sample({ spans: [withModel("gemini", "gemini-3.5-flash")] }),
        sample({ spans: [withModel("gemini", "gemini-3.5-flash")] }),
        sample({ spans: [withModel("groq", "openai/gpt-oss-120b")] }),
      ],
      NOW,
      24 * HOUR
    );
    expect(stats.providers[0]).toMatchObject({
      key: "gemini / gemini-3.5-flash",
      count: 2,
    });
    expect(stats.providers).toHaveLength(2);
  });
});

describe("computeStats — bucketing", () => {
  it("places samples in the right bucket and ignores ones outside the window", () => {
    const stats = computeStats(
      [
        sample({ startedAt: NOW - 30 * 60 * 1000 }), // most recent bucket
        sample({ startedAt: NOW - 30 * 60 * 1000, outcome: "error" }),
        sample({ startedAt: NOW - 48 * HOUR }), // older than the 24h window
      ],
      NOW,
      24 * HOUR,
      24
    );
    const last = stats.buckets[stats.buckets.length - 1];
    expect(last.total).toBe(2);
    expect(last.errors).toBe(1);
    expect(stats.buckets.reduce((n, b) => n + b.total, 0)).toBe(2);
  });
});

describe("failingStage", () => {
  it("prefers the span explicitly marked not-ok", () => {
    const s = sample({
      spans: [span("scout"), span("maps.resolve", { meta: { ok: false } })],
    });
    expect(failingStage(s)).toBe("maps.resolve");
  });

  it("falls back to the last span when nothing is marked", () => {
    expect(failingStage(sample({ spans: [span("scout"), span("writer")] }))).toBe(
      "writer"
    );
  });

  it("handles a sample with no spans at all", () => {
    expect(failingStage(sample({ spans: [] }))).toBeUndefined();
  });
});

it("counts capacity-triggered fallback and prices only attempts with known usage", () => {
  const rows = [sample({ spans: [span("writer", { meta: {
    fallbackReason: "luna_capacity", provider: "groq", model: "openai/gpt-oss-120b",
    attemptLog: [{ provider: "groq", model: "openai/gpt-oss-120b", ok: true, latencyMs: 10, estimatedCostUsd: 0.001 }],
  } }), span("planner", { meta: { attemptLog: [{ provider: "gemini", model: "historical", ok: false, latencyMs: 1 }] } })] })];
  const stats = computeStats(rows, NOW, 24 * HOUR);
  expect(stats.estimatedCostUsd).toBe(0.001); expect(stats.unpricedAttempts).toBe(1);
  expect(stats.failoverRate.hits).toBe(1);
});
