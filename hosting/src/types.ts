/**
 * Mirrors of the backend's observability shapes. These MUST stay in step with
 * `functions/src/observability/tracer.ts` and `functions/src/llm/types.ts` —
 * they describe documents another process writes, so drift here shows up as a
 * silently empty dashboard rather than a type error.
 */

export type TraceType = "curated" | "described" | "pregen";

/**
 * `blocked` never reaches Firestore — the tracer skips the write entirely for a
 * moderated prompt — but it stays in the union so the mirror is faithful.
 */
export type TraceOutcome =
  | "success"
  | "error"
  | "rate_limited"
  | "invalid"
  | "blocked";

/** One attempt in the LLM router's failover chain (`meta.attemptLog`). */
export interface RoutingAttempt {
  provider: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  estimatedCostUsd?: number;
  unknownUsage?: boolean;
}

export interface TraceSpan {
  seq: number;
  /** "request" | "scout" | "maps.resolve" | "writer" | "photos.attach" | … */
  stage: string;
  /** Start, relative to the trace start. */
  offsetMs: number;
  latencyMs: number;
  input?: unknown;
  output?: unknown;
  meta?: Record<string, unknown>;
}

/** One `generation_samples` document. Anonymous by construction — no uid. */
export interface GenerationSample {
  /** Firestore document id, attached on read (not a stored field). */
  id: string;
  traceId: string;
  type: TraceType;
  /** Epoch ms. */
  startedAt: number;
  totalLatencyMs: number;
  outcome: TraceOutcome;
  error?: string;
  spans: TraceSpan[];
  result?: unknown;
}

// ---------------------------------------------------------------------------
// Narrowing helpers for the loosely-typed span payloads.
//
// `input`/`output`/`meta` are `unknown` on the wire because each stage stores a
// different shape. Rather than casting at every call site, these read one field
// defensively — a sample written by an older backend simply yields undefined.
// ---------------------------------------------------------------------------

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function spanMetaBool(span: TraceSpan, key: string): boolean | undefined {
  const value = record(span.meta)?.[key];
  return typeof value === "boolean" ? value : undefined;
}

export function spanOutputBool(span: TraceSpan, key: string): boolean | undefined {
  const value = record(span.output)?.[key];
  return typeof value === "boolean" ? value : undefined;
}

export function spanMetaString(span: TraceSpan, key: string): string | undefined {
  const value = record(span.meta)?.[key];
  return typeof value === "string" ? value : undefined;
}

export function spanAttemptLog(span: TraceSpan): RoutingAttempt[] {
  const value = record(span.meta)?.attemptLog;
  return Array.isArray(value) ? (value as RoutingAttempt[]) : [];
}

/** The LLM stages — the ones that carry provider/model/attemptLog metadata. */
export const LLM_STAGES = ["scout", "writer", "generic", "planner"] as const;

/** Stages shown in the latency breakdown, in pipeline order. */
export const TIMED_STAGES = [
  "scout",
  "maps.resolve",
  "writer",
  "generic",
  "photos.attach",
] as const;
