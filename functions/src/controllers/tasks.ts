import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { PregenTaskPayload } from "../types";
import { generateBatch } from "../services/questService";
import { hashProfile } from "../utils/hash";
import { claimPregenJob, finishPregenJob } from "../integrations/firestore";
import { runTrace, setTraceField } from "../observability/tracer";
import { generationContext, GenerationUnavailable } from "../llm/execution";
import { validateProfilePayload, validateExcludeTitles } from "../utils/validation";
import { tokenrouterApiKey, placesApiKey, CURATED_BATCH_SIZE } from "../config";

/** Lower-priority Luna-only work; duplicate delivery cannot publish twice. */
export const pregenerateCuratedBatch = onTaskDispatched({
  secrets: [tokenrouterApiKey, placesApiKey], timeoutSeconds: 75,
  retryConfig: { maxAttempts: 5, minBackoffSeconds: 60, maxBackoffSeconds: 300, maxRetrySeconds: 3600 },
  rateLimits: { maxConcurrentDispatches: 1 },
}, async request => {
  const payload = request.data as PregenTaskPayload;
  if (!payload || typeof payload.uid !== "string" || typeof payload.jobId !== "string" ||
      !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now() ||
      validateProfilePayload(payload.profile) || !Array.isArray(payload.excludeTitles) || validateExcludeTitles(payload.excludeTitles) ||
      payload.profileHash !== hashProfile(payload.profile)) return;
  const claim = await claimPregenJob(payload);
  if (claim.status === "skip") return;
  if (claim.status === "busy") throw new GenerationUnavailable("pregen_in_progress");
  await runTrace({ type: "pregen" }, async () => {
    try {
      const quests = await generateBatch(payload.profile, CURATED_BATCH_SIZE, payload.excludeTitles, generationContext("background"));
      const published = await finishPregenJob(payload, claim.leaseId, "ready", quests)
        .catch(() => { throw new GenerationUnavailable("pregen_storage_unavailable"); });
      setTraceField({ result: { quests }, ...(published ? {} : { outcome: "invalid" as const }) });
    } catch (error) {
      const retryable = error instanceof GenerationUnavailable;
      setTraceField({ outcome: "error", error: retryable ? error.reason : "background_generation_failed" });
      await finishPregenJob(payload, claim.leaseId, retryable ? "pending" : "failed");
      if (retryable) throw error; // Cloud Tasks owns retries; never silently ACK a transient failure.
    }
  });
});
