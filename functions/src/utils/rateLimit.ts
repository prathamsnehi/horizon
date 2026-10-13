/**
 * Pure rate-limit / reservation math, kept Firestore-free so it can be unit-
 * tested in isolation and reused by the transactional reservation in
 * integrations/firestore.ts. Always driven by SERVER time.
 *
 * Two-phase, crash/timeout-safe scheme (per lane): the durable 24h window only
 * starts when quests actually land (`lastAt`, set on success). While a request
 * is in flight it holds a short-lived `pendingAt` stamp; if the process dies
 * before committing, the pending stamp is simply treated as expired after
 * PENDING_TTL_MS — so a killed run costs the user only a short cooldown, not the
 * full day, with no dependence on a rollback that may never run.
 */

/** The durable window: one delivered generation per uid per 24 hours. */
export const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Lifetime of an in-flight reservation. MUST be ≥ the function timeout so a
 * still-running generation can't have its pending stamp expire and be double-
 * entered by a concurrent request. Function timeout is 75s; this is 90s (the
 * 15s buffer covers commit-write time + clock skew). A killed run therefore
 * costs the user at most ~90s, not the full day.
 */
export const PENDING_TTL_MS = 90_000;

export interface ReservationEvaluation {
  allowed: boolean;
  /** Epoch-ms when the next attempt becomes allowed (present only when denied). */
  retryAtMs?: number;
  reason?: "daily_allowance" | "generation_in_progress";
}

/**
 * Two-phase reservation check (server time).
 * @param lastMs    epoch-ms the lane last *delivered* (durable), or null.
 * @param pendingMs epoch-ms of an in-flight reservation, or null.
 * @param nowMs     current server epoch-ms.
 *
 * a) inside the durable 24h window → deny (retry at last + 24h)
 * b) an unexpired pending reservation (< TTL) → deny (retry at pending + TTL);
 *    this is also what blocks concurrent duplicates
 * c) otherwise → allow (caller writes a fresh pending stamp)
 */
export function evaluateReservation(
  lastMs: number | null,
  pendingMs: number | null,
  nowMs: number
): ReservationEvaluation {
  if (lastMs != null && nowMs - lastMs < RATE_WINDOW_MS) {
    return { allowed: false, retryAtMs: lastMs + RATE_WINDOW_MS, reason: "daily_allowance" };
  }
  if (pendingMs != null && nowMs - pendingMs < PENDING_TTL_MS) {
    return { allowed: false, retryAtMs: pendingMs + PENDING_TTL_MS, reason: "generation_in_progress" };
  }
  return { allowed: true };
}
