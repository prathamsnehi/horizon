import { withinTimeout } from "../utils/timeout";
import { randomUUID } from "node:crypto";
import { getApps, initializeApp, App } from "firebase-admin/app";
import {
  getFirestore,
  Firestore,
  Timestamp,
  FieldValue,
} from "firebase-admin/firestore";
import {
  PregenCacheDocument,
  QuestItem,
  PregenTaskPayload,
  PregenJob,
} from "../types";
import { evaluateReservation, PENDING_TTL_MS } from "../utils/rateLimit";
import { BATCH_TTL_MS, rateLimitExemptUids } from "../config";

/**
 * Initialize the Admin SDK once at module load (runs at cold start, before any
 * request). We capture the App instance and pass it explicitly to
 * getFirestore(app) rather than relying on default-app resolution, which was
 * throwing "default Firebase app does not exist" under firebase-admin 13.
 * `initializeApp()` with no args uses the default service-account credentials
 * and bypasses security rules.
 */
const app: App = getApps().length ? getApps()[0]! : initializeApp();
let db: Firestore | null = null;

export function getDb(): Firestore {
  if (!db) {
    db = getFirestore(app);
  }
  return db;
}

// ------------------------------
// End-to-end generation samples (generation_samples)
// ------------------------------
// One de-identified record per generation: pipeline waterfall, inputs, outputs,
// and outcome. Doubles as the error log and the evaluation corpus. Carries no
// stable identity, but retained profile signals can still be identifying in
// unusual combinations; see docs/backend/observability.md.
// ------------------------------

const GENERATION_SAMPLES_COLLECTION = "generation_samples";

/**
 * Persist one end-to-end trace document (built by the tracer). Awaited by the
 * tracer at request end with a two-second wait budget. Never throws — a
 * tracing failure must not affect the request.
 * Takes a plain object to avoid a type cycle with the tracer module.
 */
export async function saveGenerationSample(doc: Record<string, unknown>): Promise<void> {
  try {
    // A JSON round-trip strips `undefined` (which Firestore rejects) and any
    // non-plain values from the arbitrary captured input/output objects.
    const safe = JSON.parse(JSON.stringify(doc));
    await withinTimeout(getDb().collection(GENERATION_SAMPLES_COLLECTION).add(safe), 2000);
  } catch {
    console.warn("[saveGenerationSample] persistence unavailable");
  }
}

// ------------------------------
// Pre-generation cache (pregen_cache/{uid})
// ------------------------------
// Ephemeral, regenerable cache of the next curated batch per user. NOT a
// durable store of user data — it holds only a pre-generated batch that the
// next request serves instantly, then discards.

const PREGEN_CACHE_COLLECTION = "pregen_cache";

/** Read a user's cached pre-generated batch (if any). */
export async function getPregenCache(
  uid: string
): Promise<PregenCacheDocument | null> {
  const snap = await getDb()
    .collection(PREGEN_CACHE_COLLECTION)
    .doc(uid)
    .get();
  return snap.exists ? (snap.data() as PregenCacheDocument) : null;
}

/** Register the newest job without discarding a concurrently written cache. */
export async function registerPregenJob(payload: PregenTaskPayload): Promise<void> {
  const job: PregenJob = { id: payload.jobId, profileHash: payload.profileHash, expiresAt: payload.expiresAt, status: "pending" };
  const ref = getDb().collection(PREGEN_CACHE_COLLECTION).doc(payload.uid);
  await getDb().runTransaction(async tx => {
    const existing = await tx.get(ref);
    // A timed-out older enqueue must not register over a newer delivery's job.
    if ((existing.data()?.job?.expiresAt ?? 0) > payload.expiresAt) return;
    tx.set(ref, { uid: payload.uid, job, expireAt: Timestamp.fromMillis(Date.now() + BATCH_TTL_MS) }, { merge: true });
  });
}

export async function claimPregenJob(payload: PregenTaskPayload): Promise<{ status: "claimed"; leaseId: string } | { status: "skip" } | { status: "busy" }> {
  const ref = getDb().collection(PREGEN_CACHE_COLLECTION).doc(payload.uid);
  const leaseId = randomUUID();
  return getDb().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const job = snap.data()?.job as PregenJob | undefined;
    const now = Date.now();
    if (!job || job.id !== payload.jobId || job.profileHash !== payload.profileHash || job.expiresAt <= now || ["ready", "failed"].includes(job.status)) return { status: "skip" as const };
    if (job.status === "running" && (job.leaseUntil ?? 0) > now) return { status: "busy" as const };
    tx.set(ref, { job: { ...job, status: "running", leaseId, leaseUntil: now + 90_000 } }, { merge: true });
    return { status: "claimed" as const, leaseId };
  });
}

/** Only the newest job's current worker may publish or update its status. */
export async function finishPregenJob(payload: PregenTaskPayload, leaseId: string, outcome: "ready" | "pending" | "failed", batch?: QuestItem[]): Promise<boolean> {
  const ref = getDb().collection(PREGEN_CACHE_COLLECTION).doc(payload.uid);
  return getDb().runTransaction(async tx => {
    const snap = await tx.get(ref);
    const job = snap.data()?.job as PregenJob | undefined;
    const now = Date.now();
    if (!job || job.id !== payload.jobId || job.leaseId !== leaseId || (job.leaseUntil ?? 0) <= now || job.expiresAt <= now) return false;
    const update: Record<string, unknown> = { job: { ...job, status: outcome, leaseId: FieldValue.delete(), leaseUntil: FieldValue.delete() } };
    if (outcome === "ready" && batch?.length) Object.assign(update, {
      nextBatch: batch, nextBatchHash: payload.profileHash, nextBatchCreatedAt: now,
      batchId: payload.jobId, expireAt: Timestamp.fromMillis(now + BATCH_TTL_MS),
    });
    tx.set(ref, update, { merge: true });
    return true;
  });
}

// ------------------------------
// Per-uid rate limiting (user_rate_limits/{uid})
// ------------------------------

const RATE_LIMITS_COLLECTION = "user_rate_limits";

/**
 * Whether a uid is exempt from the 24h limit (developer accounts — see
 * `rateLimitExemptUids` in config.ts and docs/operations/secrets.md).
 * The list lives in Secret Manager, never in source, and is empty when unset.
 *
 * Secrets are only readable while a function is executing, so this is resolved
 * per call rather than at module load, and **fails closed**: if the value can't
 * be read, nobody is exempt.
 */
function isRateLimitExempt(uid: string): boolean {
  try {
    return rateLimitExemptUids
      .value()
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .includes(uid);
  } catch {
    return false;
  }
}

export type RateAction = "curated" | "described";

/** Durable "delivered" stamp — the 24h window is measured from this. */
function lastFieldFor(action: RateAction): string {
  return action === "curated" ? "lastCuratedAt" : "lastDescribedAt";
}
/** Short-lived "in-flight" stamp — reserved before generation, cleared after. */
function pendingFieldFor(action: RateAction): string {
  return action === "curated" ? "pendingCuratedAt" : "pendingDescribedAt";
}

export interface RateReservation {
  allowed: boolean;
  /** ISO8601 of when the next attempt is allowed (present only when denied). */
  retryAt?: string;
  reason?: "daily_allowance" | "generation_in_progress";
  reservationId?: string;
}

/**
 * Phase 1 of the crash/timeout-safe reservation. One transaction: deny if the
 * durable 24h window is open, or if an unexpired pending reservation exists
 * (blocks concurrent duplicates); otherwise write a fresh `pendingAt` stamp and
 * allow. The pending stamp — NOT a durable "used" stamp — is what a killed run
 * leaves behind; it self-expires after PENDING_TTL_MS, so no rollback is needed.
 * Server time only.
 */
export async function reserveRateLimitSlot(
  uid: string,
  action: RateAction
): Promise<RateReservation> {
  // Always allow, and write no pending stamp, so an exempt uid is never gated.
  // Note this also skips the concurrent-duplicate guard, which is intentional
  // for a dev account generating repeatedly.
  if (isRateLimitExempt(uid)) return { allowed: true };

  const ref = getDb().collection(RATE_LIMITS_COLLECTION).doc(uid);
  const lastField = lastFieldFor(action);
  const pendingField = pendingFieldFor(action);
  const reservationId = randomUUID();
  return getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : undefined;
    const lastTs = data?.[lastField] as Timestamp | undefined;
    const pendingTs = data?.[pendingField] as Timestamp | undefined;

    const nowMs = Date.now();
    const result = evaluateReservation(
      lastTs ? lastTs.toMillis() : null,
      pendingTs ? pendingTs.toMillis() : null,
      nowMs
    );
    if (!result.allowed) {
      return { allowed: false, retryAt: new Date(result.retryAtMs!).toISOString(), reason: result.reason };
    }
    tx.set(ref, { [pendingField]: Timestamp.fromMillis(nowMs), [pendingField + "Id"]: reservationId }, { merge: true });
    return { allowed: true, reservationId };
  });
}

/**
 * Phase 2 (success): commit the delivery. Sets the durable `lastAt = now` (the
 * 24h window starts here, at delivery) and clears the pending stamp. Call this
 * only once the quests are about to be returned to the client.
 */
export async function commitRateLimitSlot(
  uid: string, action: RateAction, reservationId?: string,
  cachedBatch?: { batchId?: string; nextBatchCreatedAt?: number },
): Promise<void> {
  const exempt = isRateLimitExempt(uid);
  if (exempt && !cachedBatch) return;
  const ref = getDb().collection(RATE_LIMITS_COLLECTION).doc(uid);
  const cacheRef = getDb().collection(PREGEN_CACHE_COLLECTION).doc(uid);
  await getDb().runTransaction(async tx => {
    const user = exempt ? undefined : await tx.get(ref);
    const cache = cachedBatch ? await tx.get(cacheRef) : undefined;
    const pending = pendingFieldFor(action);
    const pendingAt = user?.data()?.[pending] as Timestamp | undefined;
    if (!exempt && (!reservationId || user?.data()?.[pending + "Id"] !== reservationId || !pendingAt || Date.now() - pendingAt.toMillis() >= PENDING_TTL_MS)) {
      throw new Error("generation_reservation_expired");
    }
    if (!exempt) tx.set(ref, {
      [lastFieldFor(action)]: Timestamp.now(), [pending]: FieldValue.delete(), [pending + "Id"]: FieldValue.delete(),
    }, { merge: true });
    if (cachedBatch && cache?.exists && cache.data()?.batchId === cachedBatch.batchId && cache.data()?.nextBatchCreatedAt === cachedBatch.nextBatchCreatedAt) {
      tx.set(cacheRef, { nextBatch: FieldValue.delete(), nextBatchHash: FieldValue.delete(), nextBatchCreatedAt: FieldValue.delete(), batchId: FieldValue.delete() }, { merge: true });
    }
  });
}

/** Release only the reservation held by this invocation. */
export async function releaseRateLimitSlot(uid: string, action: RateAction, reservationId?: string): Promise<void> {
  if (!reservationId || isRateLimitExempt(uid)) return;
  try {
    const ref = getDb().collection(RATE_LIMITS_COLLECTION).doc(uid);
    const pending = pendingFieldFor(action);
    await getDb().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.data()?.[pending + "Id"] === reservationId) tx.set(ref, { [pending]: FieldValue.delete(), [pending + "Id"]: FieldValue.delete() }, { merge: true });
    });
  } catch { console.warn("[releaseRateLimitSlot] unavailable; reservation will expire"); }
}

// ------------------------------
// Marketing-site metrics (site_metrics)
// ------------------------------
// One document per UTC day holding nothing but counters. There is no uid, no
// IP, no per-visitor row and no way to reconstruct one person's session — a
// visit is indistinguishable from any other visit, which is why this needs no
// cookie and no consent banner. Referrer and device are coarse buckets kept as
// count maps, never attached to an individual. Written only through the Admin
// SDK; clients are denied by the catch-all rule in firestore.rules.
// ------------------------------

export type SiteEvent = "view" | "visit" | "download";

export interface SiteEventContext {
  /** Bare referrer hostname ("twitter.com") or "direct". Already sanitized. */
  referrer?: string;
  /** Coarse form factor bucket. */
  device?: "mobile" | "desktop";
}

const EVENT_FIELD: Record<SiteEvent, string> = {
  view: "pageviews",
  visit: "visits",
  download: "downloadClicks",
};

/** Bump today's counters for one site event. Best-effort: never throws. */
export async function recordSiteEvent(
  event: SiteEvent,
  ctx: SiteEventContext = {},
): Promise<void> {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const update: Record<string, unknown> = {
    date: day,
    [EVENT_FIELD[event]]: FieldValue.increment(1),
  };
  // Attribution is only meaningful on the first hit of a session, so the maps
  // are bumped for "visit" alone — otherwise a visitor who loads three pages
  // would count as three referrals.
  if (event === "visit") {
    if (ctx.referrer) {
      update[`referrers.${ctx.referrer.replace(/\./g, "_")}`] =
        FieldValue.increment(1);
    }
    if (ctx.device) update[`devices.${ctx.device}`] = FieldValue.increment(1);
  }
  await getDb().collection("site_metrics").doc(day).set(update, { merge: true });
}
