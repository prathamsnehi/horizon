import { defineSecret } from "firebase-functions/params";

// --------
// Secrets:
// --------

// pulled directly from GC secrets manager
export const geminiApiKey = defineSecret("GEMINI_API_KEY");
export const placesApiKey = defineSecret("PLACES_API_KEY");

// Additional LLM providers for the multi-provider routing layer (all free-tier).
export const groqApiKey = defineSecret("GROQ_API_KEY");
export const mistralApiKey = defineSecret("MISTRAL_API_KEY");
export const cerebrasApiKey = defineSecret("CEREBRAS_API_KEY");

/**
 * Comma-separated uids exempt from the per-user 24h generation limit —
 * developer accounts that need to generate freely while testing.
 *
 * Stored in Secret Manager rather than a file, so the value survives every
 * deploy regardless of who triggers it (a `.env` is gitignored and therefore
 * invisible to CI, which would silently reset the list on each pipeline run).
 * See docs/operations/secrets.md for how to set it.
 *
 * Unset resolves to "" — nobody exempt — so an environment that configures
 * nothing gates every user normally.
 *
 * Safe to leave configured: `request.auth.uid` comes from a signed Firebase
 * Auth token, so only the account owner can present it, and total spend stays
 * bounded by the Maps daily quotas and the per-provider LLM rate windows.
 */
export const rateLimitExemptUids = defineSecret("RATE_LIMIT_EXEMPT_UIDS");

// ----------
// Constants:
// ----------

// How many quests a curated batch contains (server-controlled).
export const CURATED_BATCH_SIZE = 3;

// Maximum age of a pre-generated batch before it's considered stale (60 days).
export const BATCH_TTL_MS = 60 * 24 * 60 * 60 * 1000;

// The base URL for calling the Places API (New)
export const PLACES_API_BASE_URL =
  "https://places.googleapis.com/v1/places:searchText";

// ----------------------------------------
// Cloud Tasks (background pre-generation):
// ----------------------------------------

// Region the functions are deployed to; the task queue must match. Default 2nd-gen region.
export const FUNCTIONS_REGION = "us-central1";

// The onTaskDispatched function name that generates the next batch in the background.
export const PREGEN_TASK_NAME = "pregenerateCuratedBatch";
