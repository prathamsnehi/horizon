import * as functions from "firebase-functions/v2";
import { getFunctions } from "firebase-admin/functions";
import {
  CuratedQuestRequest,
  DescribedQuestRequest,
  QuestResponse,
  DescribedQuestResponse,
  QuestItem,
  PregenTaskPayload,
} from "../types";
import {
  generateBatch,
  generateDescribed,
  attachQuestPhotos,
} from "../services/questService";
import { hashProfile } from "../utils/hash";
import {
  validateProfilePayload,
  validateDescribePrompt,
  validateExcludeTitles,
} from "../utils/validation";
import {
  getPregenCache,
  clearPregenBatch,
  reserveRateLimitSlot,
  commitRateLimitSlot,
  releaseRateLimitSlot,
} from "../integrations/firestore";
import { runTrace, span, recordSpan, setTraceField } from "../observability/tracer";
import { sanitizeProfile, scrubText } from "../observability/sanitize";
import {
  geminiApiKey,
  placesApiKey,
  groqApiKey,
  mistralApiKey,
  cerebrasApiKey,
  rateLimitExemptUids,
  CURATED_BATCH_SIZE,
  BATCH_TTL_MS,
  PREGEN_TASK_NAME,
} from "../config";

const LLM_SECRETS = [
  geminiApiKey,
  placesApiKey,
  groqApiKey,
  mistralApiKey,
  cerebrasApiKey,
];

// Both callables enforce the 24h limit, so they also need the exempt-uid
// secret. A secret is only readable by a function that declares it; the
// pre-gen task never rate-limits, so it deliberately does not.
const CALLABLE_SECRETS = [...LLM_SECRETS, rateLimitExemptUids];

/**
 * Lightweight moderation for the freeform describe prompt. v1: reject obviously
 * dangerous requests via a keyword blocklist; provider safety settings are the
 * second line of defense. (A fuller moderation pass is a planned follow-up.)
 */
const DESCRIBE_BLOCKLIST = [
  "suicide",
  "self-harm",
  "self harm",
  "kill myself",
  "explosive",
  "make a bomb",
  "weapon",
  "overdose",
];
function isDescribePromptAllowed(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return !DESCRIBE_BLOCKLIST.some((term) => p.includes(term));
}

/** Best-effort enqueue of the background next-batch pre-generation task. */
async function enqueuePregen(payload: PregenTaskPayload): Promise<void> {
  try {
    await getFunctions().taskQueue(PREGEN_TASK_NAME).enqueue(payload);
  } catch (err) {
    console.error("[enqueuePregen] failed (next batch will be a sync miss):", err);
  }
}

/**
 * `generateCuratedQuests` — the client-facing daily batch.
 *
 * Cache-first: serves a valid pre-generated batch when present, else generates
 * synchronously. After serving, it consumes that cache slot and enqueues a Cloud
 * Task to pre-generate the next batch. Count is server-controlled
 * (CURATED_BATCH_SIZE); the request carries only { profile, excludeTitles? }.
 */
export const generateCuratedQuests = functions.https.onCall(
  { enforceAppCheck: true, secrets: CALLABLE_SECRETS },
  async (request): Promise<QuestResponse> => {
    // A: require authentication (App Check is enforced by the runtime).
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Sign in to generate quests."
      );
    }
    const uid = request.auth.uid;

    return runTrace({ type: "curated" }, async () => {
      // C: validate structure + content before any spend or slot reservation.
      const data = request.data as CuratedQuestRequest;
      if (!data || typeof data !== "object") {
        setTraceField({ outcome: "invalid" });
        throw new functions.https.HttpsError("invalid-argument", "Invalid request payload.");
      }
      const profileErr = validateProfilePayload(data.profile);
      if (profileErr) {
        setTraceField({ outcome: "invalid" });
        throw new functions.https.HttpsError("invalid-argument", profileErr);
      }
      const excludeErr = validateExcludeTitles(data.excludeTitles);
      if (excludeErr) {
        setTraceField({ outcome: "invalid" });
        throw new functions.https.HttpsError("invalid-argument", excludeErr);
      }

      const { profile, excludeTitles } = data;
      recordSpan("request", {
        meta: { profile: sanitizeProfile(profile), excludeTitles },
      });

      // B: reserve the per-uid 24h curated slot (transactional, server time).
      const reservation = await span(
        "ratelimit.reserve",
        () => reserveRateLimitSlot(uid, "curated"),
        {
          input: { action: "curated" },
          onResult: (r) => ({ meta: { allowed: r.allowed, retryAt: r.retryAt } }),
        }
      );
      if (!reservation.allowed) {
        setTraceField({ outcome: "rate_limited" });
        throw new functions.https.HttpsError(
          "resource-exhausted",
          "You've used today's curated quest. Come back tomorrow.",
          { retryAt: reservation.retryAt, scope: "curated" }
        );
      }

      try {
        const hash = hashProfile(profile);
        const cache = await getPregenCache(uid);

        // A cached batch is usable only if it exists, was built for this exact
        // profile, and hasn't gone stale. Caching/pre-gen is a cost optimization,
        // not a rate limit — a miss just means we generate synchronously.
        let cacheHit = false;
        if (cache && cache.nextBatch && cache.nextBatch.length > 0) {
          const builtForThisProfile = cache.nextBatchHash === hash;
          const age = Date.now() - (cache.nextBatchCreatedAt ?? 0);
          const fresh = age < BATCH_TTL_MS;
          cacheHit = builtForThisProfile && fresh;
        }
        recordSpan("cache.lookup", {
          // No profileHash/cachedHash: a stable digest of the profile would
          // re-link every sample from the same user, defeating the anonymity.
          output: {
            hit: cacheHit,
            ageMs: cache?.nextBatchCreatedAt
              ? Date.now() - cache.nextBatchCreatedAt
              : null,
          },
        });

        let batch: QuestItem[];
        if (cacheHit) {
          batch = cache!.nextBatch!;
        } else {
          batch = await generateBatch(profile, CURATED_BATCH_SIZE, excludeTitles ?? []);
        }

        // These operations are independent, so run them together: invalidate
        // the consumed cache entry (required, so it cannot be re-served) and
        // best-effort queue the next batch.
        await Promise.all([
          clearPregenBatch(uid),
          enqueuePregen({ uid, profile }),
        ]);

        console.log(`[generateCuratedQuests] served ${batch.length} quests (cached=${cacheHit})`);

        // Record the assembled batch (reference-only, NO base64) as the trace result.
        setTraceField({ result: { quests: batch } });

        // Embed hero-image bytes for the response ONLY. The selected cache batch
        // and trace result stay reference-only and under Firestore's 1MB cap.
        // The commit runs in parallel — both are past the point of no return
        // (quests are landing), and photo attach is best-effort (never throws).
        // Commit starts the 24h window at delivery; a timeout before this leaves
        // only the pending stamp (self-expires in ≤90s — no burned day).
        const [responseBatch] = await Promise.all([
          attachQuestPhotos(batch),
          span("ratelimit.commit", () => commitRateLimitSlot(uid, "curated")),
        ]);
        return { quests: responseBatch };
      } catch (error) {
        // Generation failed — free the pending slot immediately (best-effort; a
        // process death would let it self-expire within 90s instead).
        await releaseRateLimitSlot(uid, "curated");
        console.error("[generateCuratedQuests] Fatal error:", error);
        throw new functions.https.HttpsError(
          "internal",
          "An error occurred while generating quests."
        );
      }
    });
  }
);

/**
 * `generateUserDescribedQuest` — one tailored quest from a freeform
 * prompt. Auto-decides real-location vs location-agnostic. Limited to one per
 * day per device: a repeat with the SAME prompt re-serves (retry-safe), a
 * DIFFERENT prompt the same day is rejected as rate-limited.
 */
export const generateUserDescribedQuest = functions.https.onCall(
  { enforceAppCheck: true, secrets: CALLABLE_SECRETS },
  async (request): Promise<DescribedQuestResponse> => {
    // A: require authentication (App Check is enforced by the runtime).
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Sign in to generate quests."
      );
    }
    const uid = request.auth.uid;

    return runTrace({ type: "described" }, async () => {
      // C: validate structure + content before any spend or slot reservation.
      const data = request.data as DescribedQuestRequest;
      if (!data || typeof data !== "object") {
        setTraceField({ outcome: "invalid" });
        throw new functions.https.HttpsError("invalid-argument", "Invalid request payload.");
      }
      const promptErr = validateDescribePrompt(data.prompt);
      if (promptErr) {
        setTraceField({ outcome: "invalid" });
        throw new functions.https.HttpsError("invalid-argument", promptErr);
      }
      const profileErr = validateProfilePayload(data.profile);
      if (profileErr) {
        setTraceField({ outcome: "invalid" });
        throw new functions.https.HttpsError("invalid-argument", profileErr);
      }

      const prompt = data.prompt.trim();
      const { profile } = data;
      recordSpan("request", {
        meta: { profile: sanitizeProfile(profile), prompt: scrubText(prompt) },
      });

      // Moderation — before spend and before reserving the slot.
      if (!isDescribePromptAllowed(prompt)) {
        setTraceField({ outcome: "blocked" });
        recordSpan("moderation", { output: { allowed: false } });
        throw new functions.https.HttpsError(
          "invalid-argument",
          "That request can't be turned into a quest."
        );
      }
      recordSpan("moderation", { output: { allowed: true } });

      // B: reserve the per-uid 24h described slot (transactional, server time).
      const reservation = await span(
        "ratelimit.reserve",
        () => reserveRateLimitSlot(uid, "described"),
        {
          input: { action: "described" },
          onResult: (r) => ({ meta: { allowed: r.allowed, retryAt: r.retryAt } }),
        }
      );
      if (!reservation.allowed) {
        setTraceField({ outcome: "rate_limited" });
        throw new functions.https.HttpsError(
          "resource-exhausted",
          "You've used today's custom quest. Come back tomorrow.",
          { retryAt: reservation.retryAt, scope: "described" }
        );
      }

      try {
        const quest = await generateDescribed(prompt, profile);
        if (!quest) {
          throw new Error("Describe generation produced no quest.");
        }
        console.log("[generateUserDescribedQuest] served a described quest");
        setTraceField({ result: { quest } });
        // Embed the hero-image bytes for the response (nothing to persist — a
        // described quest is one-off and isn't cached). Commit runs in parallel:
        // the quest is landing and photo attach is best-effort (never throws).
        // Commit starts the 24h window at delivery.
        const [[responseQuest]] = await Promise.all([
          attachQuestPhotos([quest]),
          span("ratelimit.commit", () => commitRateLimitSlot(uid, "described")),
        ]);
        return { quest: responseQuest };
      } catch (error) {
        // Generation failed — free the pending slot immediately (best-effort; a
        // process death would let it self-expire within 90s instead).
        await releaseRateLimitSlot(uid, "described");
        console.error("[generateUserDescribedQuest] Fatal error:", error);
        throw new functions.https.HttpsError(
          "internal",
          "An error occurred while crafting your quest."
        );
      }
    });
  }
);
