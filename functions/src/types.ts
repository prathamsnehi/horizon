/**
 * Represents the detailed profile of the user collected
 * during the Guided UI Onboarding.
 * This is sent by the client to the Cloud Functions.
 */

// --------------
// general types:
// --------------

export type TransportationMode =
  | "walking"
  | "publicTransport"
  | "car"
  | "bike"
  | "rideshare";

export interface UserProfile {
  interests: string[];
  comfortZoneEdges: string[];
  vibe: string[];
  experimentationLevel: number; // e.g., 1 to 5
  budget: string[];
  transportation: TransportationMode[];
  locationPreferences: string[];
  additionalContext: string | null;
  city: string;
  cityLatitude?: number;
  cityLongitude?: number;
}

// -------------------------
// generateCuratedQuests types:
// -------------------------

/**
 * Request for the curated daily batch. Count is server-controlled
 * (CURATED_BATCH_SIZE), so the client does not send it.
 */
export interface CuratedQuestRequest {
  profile: UserProfile;
  excludeTitles?: string[];
}

// -------------------------
// generateUserDescribedQuest types:
// -------------------------

/**
 * Request for a single, freeform user-described quest.
 */
export interface DescribedQuestRequest {
  prompt: string;
  profile: UserProfile;
}

export interface DescribedQuestResponse {
  quest: QuestItem | null;
}

/**
 * Pass-0 (Planner) output for the describe flow: decide whether the user's
 * prompt implies a real place (location) or an at-home / abstract quest (generic).
 */
export interface DescribePlan {
  mode: "location" | "generic";
  textQuery?: string; // Google Maps query when mode === "location"
}

export interface TransportationOption {
  mode: TransportationMode;
  estimatedTravelMinutes: number;
  isRecommended: boolean;
}

export interface LocationInformation {
  name: string;
  address: string;
  locationDescription: string;
  latitude: number;
  longitude: number;
  photoReference: string; // queryable google maps photo identifier
  googleMapsURL: string;
  distanceMiles?: number;
  transportationOptions?: TransportationOption[];
  photoImageBase64?: string; // gmaps photo identifier -> image -> base64, attached just before returning Quest
  photoContentType?: string; // content type of the base64 image (image/jpeg, image/png, etc)
}

export interface QuestItem {
  title: string;
  questDescription: string;
  difficulty: "easy" | "moderate" | "hard" | "extreme";
  estimatedActivityMinutes: number;
  categories: string[];

  // Which of the user's comfort-zone edges this quest targets, ordered by weight
  // (primary first, 1-3). Verbatim echoes of strings from the request's
  // `comfortZoneEdges`. Present on location (writer) quests; omitted on generic
  // fallback quests (client decodes absent → []).
  pushesComfortZoneEdges?: string[];

  // Location-Based Properties:
  locationInformation?: LocationInformation;
}

export interface QuestResponse {
  quests: QuestItem[] | null;
}

// ------------------------------
// generateGetStartedGuide types:
// ------------------------------

export interface GetStartedRequest {
  quest: QuestItem;
  profile: UserProfile;
}

export interface GetStartedResponse {
  steps: string[];
}

// ------------------------------
// Quest Orchestration Types (Two-Pass Architecture)
// ------------------------------

/**
 * Represents a single search query intended for Google Maps
 */
export interface LocationConcept {
  textQuery: string;
  intendedDifficulty: "easy" | "moderate" | "hard" | "extreme";
}

/**
 * The expected JSON structure returned by the model in Pass 1 (Scout)
 */
export interface LocationConceptsResponse {
  locationConcepts: LocationConcept[];
}

// ------------------------------
// Firestore Document Schemas:
// ------------------------------

/**
 * Represents a document in the `pregen_cache/{uid}` collection — an ephemeral,
 * regenerable cache holding the next pre-generated curated batch for a user. NOT
 * a durable store of user data: the batch is written by the background pre-gen
 * task, served instantly on the next request, then cleared.
 */
export interface PregenCacheDocument {
  uid: string;
  nextBatch?: QuestItem[];
  nextBatchHash?: string; // profileHash of nextBatch (invalidates on profile change)
  batchId?: string;
  job?: PregenJob;
  nextBatchCreatedAt?: number; // Unix ms, for TTL validation
}

/**
 * Payload enqueued to the Cloud Task that pre-generates the next curated batch.
 */
export interface PregenTaskPayload {
  uid: string;
  profile: UserProfile;
  jobId: string;
  profileHash: string;
  expiresAt: number;
  excludeTitles: string[];
}
export interface PregenJob {
  id: string;
  profileHash: string;
  expiresAt: number;
  status: "pending" | "running" | "ready" | "failed";
  leaseId?: string;
  leaseUntil?: number;
}
