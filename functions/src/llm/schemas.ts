import { z } from "zod";

/**
 * Zod schemas for the three AI stages. These are portable across providers via
 * the AI SDK's `generateText` with `Output.object` (which enforces + validates structured output),
 * replacing the hand-written provider-native JSON schemas.
 */

const difficultyEnum = z.enum(["easy", "moderate", "hard", "extreme"]);
const transportModeEnum = z.enum([
  "walking",
  "publicTransport",
  "car",
  "bike",
  "rideshare",
]);

// Pass 1 (Scout): abstract Google Maps search queries.
export const locationConceptsSchema = z.object({
  locationConcepts: z.array(
    z.object({
      textQuery: z.string(),
      intendedDifficulty: difficultyEnum,
    })
  ),
});

// Pass 2 (Writer): final quests tied to resolved locations.
export const writerQuestsSchema = z.object({
  quests: z.array(
    z.object({
      title: z.string(),
      questDescription: z.string(),
      difficulty: difficultyEnum,
      estimatedActivityMinutes: z.number().int(),
      categories: z.array(z.string()),
      assignedLocationId: z.string(),
      recommendedTransportationMode: transportModeEnum,
      // A very short (1-2 sentence) summary of the place itself, written by the
      // model — replaces the Atmosphere-tier Google editorial summary.
      locationDescription: z.string(),
      // The user comfort-zone edge(s) this quest pushes, copied VERBATIM from the
      // provided list, ordered primary-first, 1-3 entries. The server re-filters
      // this against the real profile edges, so anything invented is dropped.
      pushesComfortZoneEdges: z.array(z.string()),
    })
  ),
});

// Pass 0 (Describe Planner): does the user's freeform prompt need a real place?
export const describePlanSchema = z.object({
  mode: z.enum(["location", "generic"]),
  textQuery: z.string().nullable(),
});

// Generic fallback: location-agnostic quests (no assignedLocationId).
export const genericQuestsSchema = z.object({
  quests: z.array(
    z.object({
      title: z.string(),
      questDescription: z.string(),
      difficulty: difficultyEnum,
      estimatedActivityMinutes: z.number().int(),
      categories: z.array(z.string()),
    })
  ),
});
