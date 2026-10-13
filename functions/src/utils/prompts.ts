import { UserProfile } from "../types";

/**
 * Builds the prompt for Pass 1 (Scout) to generate location concepts.
 *
 * @param profile - The user's detailed profile
 * @param count - The number of location concepts to generate
 * @returns The formatted prompt string
 */
export function buildLocationConceptsPrompt(
  profile: UserProfile,
  count: number,
  excludeTitles: string[] = [],
): string {
  // Compress profile to reduce tokens
  const interests = profile.interests.join(",") || "None";
  const vibe = profile.vibe.join(",") || "None";
  const locationPreferences = profile.locationPreferences.join(",") || "None";
  const edges = profile.comfortZoneEdges.join(" | ") || "None";

  return `You are a sharp, well-traveled local in ${profile.city} with genuinely great taste. Produce EXACTLY ${count} Google Maps search queries. Each must resolve to a specific, real, well-regarded place where the user can do a small challenge that pushes one of their COMFORT-ZONE EDGES.

THE POINT (matters most):
Horizon sends people to do the things they avoid. Their edges below are what they're reluctant or afraid to do. Every query must set up a place where acting on an edge is natural. Interests decide WHERE and WHAT KIND of place; the EDGE decides what makes it a stretch.
Example: edge "Talking to strangers" + interest "coffee" -> "specialty coffee bar with counter seating in ${profile.city}" (a place where striking up a conversation is natural) — NOT just "highly-rated coffee shop".

COMFORT-ZONE EDGES (target these): ${edges}
Interests (flavor / where): ${interests} | Vibe (tone): ${vibe} | Location prefs: ${locationPreferences}
City: ${profile.city}

HOW TO CHOOSE:
- SPREAD across edges. If the user has several, cover DIFFERENT ones across the ${count} queries — not ${count} variations on a single edge.
- Pick real, well-regarded places (a specific cafe, studio, class, market, venue, trailhead) — quality over novelty. A great spot where the edge is doable beats an obscure one.
- Write FINDABLE queries: real businesses/POIs with reviews. Avoid abstractions Maps can't resolve ("urban exploration sites", "ghost tour starting points").
- Include the city/region name in every query so Maps searches the correct area.

HOW FAR TO PUSH — experimentation level ${profile.experimentationLevel}/5 sets how far past the edge to go, and drives 'intendedDifficulty' (the size of the social/personal stretch, NOT geographic distance):
1 -> easy (right at the edge of comfortable)
2 -> easy/moderate (a step out)
3 -> moderate (a real stretch)
4 -> hard (well beyond)
5 -> hard/extreme (far beyond — bolder settings and asks)
Assign each concept an 'intendedDifficulty' from this scale.
${excludeTitles.length > 0 ? `\nDo NOT generate concepts similar to these recently completed quests: ${excludeTitles.join(", ")}` : ""}
`;
}

/**
 * Builds the prompt for Pass 2 (Writer) to generate final quests.
 *
 * `userIntent` (optional) is the user's freeform "describe a quest" request;
 * when present, the quest should fulfill it using the provided location(s).
 */
export function buildQuestWriterPrompt(
  profile: UserProfile,
  mapsResults: any[],
  userIntent?: string,
): string {
  const edges = profile.comfortZoneEdges.join(" | ") || "None";

  return `Write the final quests based on the real locations provided. Each quest must push the user OUT of their comfort zone at that place — a concrete, doable action, never just "visit" or "explore".

USER PROFILE:
Interests: ${profile.interests.join(",")}
Comfort-zone edges (what they avoid / want to face): ${edges}
Experimentation level: ${profile.experimentationLevel}/5
${userIntent ? `\nUSER REQUEST: "${userIntent}"\nThe quest MUST directly fulfill this request using the location(s) below. Let the request lead; bring in a comfort-zone edge only where it fits naturally.\n` : ""}
LOCATIONS:
${JSON.stringify(mapsResults, null, 2)}

RULES:
1. Generate exactly ${mapsResults.length} quests.
2. Each quest must require ACTING on a comfort-zone edge at that place (e.g. edge "Talking to strangers" at a cafe -> "ask the barista to pick your drink for you and ask what got them into coffee"), not passive visiting.${userIntent ? "" : " Spread the set across DIFFERENT edges rather than repeating one."}
3. 'difficulty' = how far past the edge the quest pushes, set from the experimentation level: 1 -> easy, 2 -> easy/moderate, 3 -> moderate, 4 -> hard, 5 -> hard/extreme.
4. 'pushesComfortZoneEdges': the edge(s) this quest actually makes the user face — copied VERBATIM from the comfort-zone edges above (exact wording and casing), ordered most-central first, 1 to 3 entries max. Do NOT rephrase, pluralize, or invent an edge the user didn't list. Include only edges the quest genuinely pushes.
5. 'estimatedActivityMinutes' must reflect the activity time in minutes. Do NOT include travel time.
6. For each quest, provide the 'assignedLocationId' of the location you are writing the quest for.
7. Provide the 'recommendedTransportationMode' (must be one of the modes available in that location's transportationOptions).
8. Write a 'locationDescription': a vivid but VERY short summary of the place itself (what it is and why it's worth visiting), based on its name and address. Maximum 1-2 sentences. Describe the PLACE, not the quest.`;
}

/**
 * Builds the Pass-0 (Describe Planner) prompt: decide whether the user's
 * freeform request needs a specific real-world place or can be an at-home /
 * online / abstract activity.
 */
export function buildDescribePlannerPrompt(
  userPrompt: string,
  profile: UserProfile,
): string {
  return `A user described a quest they want. Decide how to fulfill it.

USER REQUEST: "${userPrompt}"
City: ${profile.city}

If fulfilling it requires going to a specific real-world place, set mode="location" and provide a Google Maps "textQuery" (a specific, findable place type that includes the city/region).
If it can be done at home, online, or anywhere (no specific venue needed), set mode="generic" and set textQuery to null.`;
}

/**
 * Builds the prompt for generating generic, at-home, or location-agnostic quests.
 * This is used as a graceful fallback when Maps API fails to resolve locations.
 */
export function buildGenericQuestWriterPrompt(
  profile: UserProfile,
  count: number,
  excludeTitles: string[] = [],
  userIntent?: string,
): string {
  return `Write exactly ${count} generic, at-home, or location-agnostic quests.

USER PROFILE:
Interests: ${profile.interests.join(",")}
Comfort-zone edges (what they avoid / want to face): ${profile.comfortZoneEdges.join(",")}
Vibe: ${profile.vibe.join(",")}
Context: ${profile.additionalContext || "None"}
${userIntent ? `\nUSER REQUEST: "${userIntent}"\nThe quest(s) MUST directly fulfill this request.\n` : ""}
RULES:
1. Generate exactly ${count} quests.
2. These quests can involve exploring or traveling, but they MUST be generic (e.g., "find a local cafe", "take a walk in a nearby park") because they will not be tied to a specific Google Maps location. They can also be at-home or online activities.
3. 'estimatedActivityMinutes' must reflect the activity time in minutes.
4. Integrate the user's Interests, Vibe, and — where it fits naturally — a comfort-zone edge, to make these highly personalized.
${excludeTitles.length > 0 ? `- IMPORTANT: Do NOT generate quests similar to these recently completed quests: ${excludeTitles.join(", ")}` : ""}
`;
}
