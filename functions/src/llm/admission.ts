import { GenerationContext, ProviderId } from "./types";

export const PROVIDER_LIMITS = {
  tokenrouter: { rpm: 12, concurrency: 3, backgroundRpm: 4, backgroundConcurrency: 1 },
  groq: { rpm: 27, concurrency: 1, rpd: 900 },
};
export interface ProviderLease {
  id: string;
  priority: GenerationContext["priority"];
  expiresAt: number;
  probe?: boolean;
}
export interface ProviderState {
  starts?: Array<{ at: number; background: boolean }>;
  leases?: ProviderLease[];
  day?: string;
  dailyStarts?: number;
  cooldownUntil?: number;
  recovering?: boolean;
  tokensRemaining?: number;
  tokensResetAt?: number;
}
export interface AdmissionResult {
  state: ProviderState;
  allowed: boolean;
  retryAtMs?: number;
  lease?: ProviderLease;
}

/** Pure rolling-window admission, evaluated inside the Firestore transaction. */
export function admit(
  provider: ProviderId, previous: ProviderState, priority: GenerationContext["priority"],
  now: number, id: string, tokenEstimate: number,
): AdmissionResult {
  const state: ProviderState = {
    ...previous,
    starts: (previous.starts ?? []).filter(s => s.at > now - 60_000),
    leases: (previous.leases ?? []).filter(l => l.expiresAt > now),
    day: new Date(now).toISOString().slice(0, 10),
  };
  state.dailyStarts = previous.day === state.day ? previous.dailyStarts ?? 0 : 0;
  const limits = PROVIDER_LIMITS[provider];
  const blockers: number[] = [];
  if ((state.cooldownUntil ?? 0) > now) blockers.push(state.cooldownUntil!);
  if (state.starts!.length >= limits.rpm) blockers.push(state.starts![0].at + 60_000);
  if (state.leases!.length >= limits.concurrency) blockers.push(Math.min(...state.leases!.map(l => l.expiresAt)));
  if (state.recovering && state.leases!.some(l => l.probe)) blockers.push(state.leases!.find(l => l.probe)!.expiresAt);
  if (provider === "tokenrouter" && priority === "background") {
    const background = state.starts!.filter(s => s.background);
    if (background.length >= PROVIDER_LIMITS.tokenrouter.backgroundRpm) blockers.push(background[0].at + 60_000);
    const leases = state.leases!.filter(l => l.priority === "background");
    if (leases.length >= PROVIDER_LIMITS.tokenrouter.backgroundConcurrency) blockers.push(leases[0].expiresAt);
  }
  if (provider === "groq") {
    if (state.dailyStarts! >= PROVIDER_LIMITS.groq.rpd) blockers.push(Date.parse(state.day! + "T00:00:00Z") + 86_400_000);
    if ((state.tokensResetAt ?? 0) > now && (state.tokensRemaining ?? Infinity) < tokenEstimate) blockers.push(state.tokensResetAt!);
  }
  if (blockers.length) return { state, allowed: false, retryAtMs: Math.max(...blockers) };
  const lease: ProviderLease = { id, priority, expiresAt: now + 25_000, ...(state.recovering ? { probe: true } : {}) };
  state.leases!.push(lease);
  state.starts!.push({ at: now, background: priority === "background" });
  state.dailyStarts!++;
  return { state, allowed: true, lease };
}

export function retryAfterMs(headers: Record<string, string> | undefined, now: number, fallback: number): number {
  const value = headers?.["retry-after"];
  if (!value) return now + fallback;
  const seconds = Number(value);
  const at = Number.isFinite(seconds) ? now + Math.max(0, seconds) * 1000 : Date.parse(value);
  return Number.isFinite(at) && at > now ? at : now + fallback;
}

/** Groq reset headers use durations such as 1m2.5s. */
export function resetDurationMs(value: string | undefined): number | undefined {
  if (!value || !/^(?:\d+(?:\.\d+)?(?:ms|s|m|h))+$/.test(value)) return undefined;
  const units: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };
  return [...value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)].reduce((sum, part) => sum + Number(part[1]) * units[part[2]], 0);
}

export function settle(
  previous: ProviderState, leaseId: string, now: number,
  result: { ok: boolean; transient?: boolean; status?: number; headers?: Record<string, string> },
): ProviderState {
  const state = { ...previous, leases: (previous.leases ?? []).filter(l => l.id !== leaseId) };
  const lease = previous.leases?.find(l => l.id === leaseId);
  if (result.transient) {
    state.cooldownUntil = Math.max(state.cooldownUntil ?? 0, retryAfterMs(result.headers, now, result.status === 429 ? 60_000 : 30_000));
    state.recovering = true;
  } else if (result.ok && lease?.probe && (state.cooldownUntil ?? 0) <= now) {
    state.recovering = false;
  }
  const remaining = result.headers?.["x-ratelimit-remaining-tokens"];
  const reset = resetDurationMs(result.headers?.["x-ratelimit-reset-tokens"]);
  if (remaining != null && Number.isFinite(Number(remaining)) && reset != null) {
    state.tokensRemaining = Math.max(0, Number(remaining));
    state.tokensResetAt = now + reset;
  }
  return state;
}
