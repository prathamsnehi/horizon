import {
  UserProfile,
  LocationConcept,
  QuestItem,
  LocationInformation,
  DescribePlan,
} from "../types";
import {
  buildLocationConceptsPrompt,
  buildQuestWriterPrompt,
  buildGenericQuestWriterPrompt,
  buildDescribePlannerPrompt,
} from "../utils/prompts";
import { generateStructured } from "./router";
import {
  locationConceptsSchema,
  writerQuestsSchema,
  genericQuestsSchema,
  describePlanSchema,
} from "./schemas";
import { recordSpan } from "../observability/tracer";
import { scrubText } from "../observability/sanitize";
import { GenerationContext, RoutingResult } from "./types";

/** Routing provider/model/attempts + failover chain, as trace-span meta. */
function routingMeta(
  result: RoutingResult<unknown>,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    provider: result.providerUsed,
    model: result.modelUsed,
    attempts: result.attempts,
    attemptLog: result.attemptLog,
    capacityWaitMs: result.capacityWaitMs,
    fallbackReason: result.fallbackReason,
    ...extra,
  };
}

/**
 * Pass 1 (Scout): generate abstract Google Maps search queries.
 */
export async function generateLocationConcepts(
  profile: UserProfile,
  count: number,
  excludeTitles: string[] = [],
  context?: GenerationContext,
): Promise<LocationConcept[]> {
  const prompt = buildLocationConceptsPrompt(profile, count, excludeTitles);
  const result = await generateStructured("scout", {
    context,
    schema: locationConceptsSchema,
    prompt,
  });
  const locationConcepts = result.object.locationConcepts ?? [];
  recordSpan("scout", {
    latencyMs: result.latencyMs,
    input: { count, excludeTitles },
    output: { locationConcepts },
    meta: routingMeta(result),
  });
  return locationConcepts;
}

/**
 * Pass 2 (Writer): generate final quests using the rich location data.
 * Re-attaches the exact, untouched Maps data by assignedLocationId and marks
 * the recommended transport mode.
 */
export async function generateQuestsWriter(
  profile: UserProfile,
  locations: LocationInformation[],
  userIntent?: string,
  context?: GenerationContext,
): Promise<QuestItem[]> {
  // Inject IDs to guarantee we map the exact untouched Maps data back later.
  const locationsWithIds = locations.map((loc, index) => ({
    id: `loc_${index}`,
    ...loc,
  }));

  const prompt = buildQuestWriterPrompt(profile, locationsWithIds, userIntent);
  const result = await generateStructured("writer", {
    context,
    schema: writerQuestsSchema,
    prompt,
  });
  const rawQuests = result.object.quests ?? [];
  recordSpan("writer", {
    latencyMs: result.latencyMs,
    input: { locations: locationsWithIds, userIntent: scrubText(userIntent) },
    output: { quests: rawQuests },
    meta: routingMeta(result),
  });

  // Verbatim guarantee: the client renders these back to the user, so an entry
  // must be an EXACT string the user submitted. Drop anything the model
  // rephrased or invented, preserve the model's (weight) order, cap at 3.
  const allowedEdges = new Set(profile.comfortZoneEdges);

  return rawQuests.map((sq) => {
    const pushesComfortZoneEdges = (sq.pushesComfortZoneEdges ?? [])
      .filter((edge) => allowedEdges.has(edge))
      .slice(0, 3);

    const originalLocation = locationsWithIds.find(
      (l) => l.id === sq.assignedLocationId,
    );

    let locationInfo: LocationInformation | undefined = undefined;
    if (originalLocation) {
      const { id, ...rest } = originalLocation;
      void id;
      locationInfo = rest as LocationInformation;

      // The model writes the short location summary (Maps no longer supplies one)
      locationInfo.locationDescription = sq.locationDescription ?? "";

      // Apply the recommended mode to the transportationOptions array.
      if (locationInfo.transportationOptions) {
        locationInfo.transportationOptions =
          locationInfo.transportationOptions.map((opt) => ({
            ...opt,
            isRecommended: opt.mode === sq.recommendedTransportationMode,
          }));
      }
    }

    return {
      title: sq.title,
      questDescription: sq.questDescription,
      difficulty: sq.difficulty,
      estimatedActivityMinutes: sq.estimatedActivityMinutes,
      categories: sq.categories,
      pushesComfortZoneEdges,
      locationInformation: locationInfo,
    };
  });
}

/**
 * Generates generic (no-location) quests to fill deficits when Maps fails
 * to resolve enough locations.
 */
export async function generateGenericQuests(
  profile: UserProfile,
  count: number,
  excludeTitles: string[] = [],
  userIntent?: string,
  reason?: string,
  context?: GenerationContext,
): Promise<QuestItem[]> {
  if (count <= 0) return [];

  const prompt = buildGenericQuestWriterPrompt(
    profile,
    count,
    excludeTitles,
    userIntent,
  );
  const result = await generateStructured("generic", {
    context,
    schema: genericQuestsSchema,
    prompt,
    temperature: 0.8,
  });
  const rawQuests = result.object.quests ?? [];
  recordSpan("generic", {
    latencyMs: result.latencyMs,
    input: { count, excludeTitles, userIntent: scrubText(userIntent) },
    output: { quests: rawQuests },
    meta: routingMeta(result, reason ? { reason } : undefined),
  });

  return rawQuests.map((sq) => ({
    title: sq.title,
    questDescription: sq.questDescription,
    difficulty: sq.difficulty,
    estimatedActivityMinutes: sq.estimatedActivityMinutes,
    categories: sq.categories,
  }));
}

/**
 * Pass 0 (Describe Planner): decide whether a user's freeform describe request
 * needs a specific real-world place (location) or is location-agnostic (generic).
 * Uses the same gateway as the other stages.
 */
export async function planDescribedQuest(
  prompt: string,
  profile: UserProfile,
  context?: GenerationContext,
): Promise<DescribePlan> {
  const plannerPrompt = buildDescribePlannerPrompt(prompt, profile);
  const result = await generateStructured("planner", {
    context,
    schema: describePlanSchema,
    prompt: plannerPrompt,
  });
  recordSpan("planner", {
    latencyMs: result.latencyMs,
    input: { userPrompt: scrubText(prompt) },
    output: { plan: result.object },
    meta: routingMeta(result),
  });
  return { mode: result.object.mode, ...(result.object.textQuery != null ? { textQuery: result.object.textQuery } : {}) };
}
