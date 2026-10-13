import { LocationInformation } from "../types";
import { placesApiKey, PLACES_API_BASE_URL } from "../config";
import { isValidPhotoReference } from "../utils/validation";

/**
 * Helper to fetch places from Google Maps API
 */
async function fetchPlaces(queryText: string, maxResults = 10, signal: AbortSignal = AbortSignal.timeout(8000)) {
  const response = await fetch(PLACES_API_BASE_URL, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": placesApiKey.value(),
      // Fields received puts the project's Maps API in the Pro SKU Tier (~5k/mo free)
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.location,places.photos,places.googleMapsUri,places.businessStatus",
    },
    body: JSON.stringify({
      textQuery: queryText,
      maxResultCount: maxResults,
    }),
  });

  if (!response.ok) {
    console.error(
      `Places API Error: ${response.status} ${response.statusText}`,
    );
    return [];
  }

  const data = await response.json();
  return data.places || [];
}

/**
 * Helper to map a raw Google Place object to our LocationInformation type
 */
function mapPlaceToLocation(place: any): LocationInformation {
  // Store only the durable photo reference (the `name`); the media URL — which
  // needs the API key — is reconstructed server-side at fetch time so the key
  // never lands in the cache or a client response.
  const photoReference: string =
    place.photos && place.photos.length > 0 ? place.photos[0].name || "" : "";

  return {
    name: place.displayName?.text || "",
    address: place.formattedAddress || "",
    locationDescription: "", // provided by the pass 2 writer function (no need to be in Enterprise SKU)
    latitude: place.location?.latitude || 0,
    longitude: place.location?.longitude || 0,
    googleMapsURL: place.googleMapsUri || "",
    photoReference: photoReference,
  };
}

// Selection pool to pick a random top x location for quest:
const SELECTION_POOL_SIZE = 5;

/**
 * Returns a good, varied location for the query, since Places API `searchText` already
 * returns results ordered by relevance/prominence (which bakes in popularity and
 * ratings)
 */
export async function getBestLocation(
  queryText: string,
  signal?: AbortSignal,
): Promise<LocationInformation | null> {
  let places;
  try { places = await fetchPlaces(queryText, 10, signal); }
  catch { return null; }

  const openPlaces = places.filter(
    (p: any) =>
      p.businessStatus !== "CLOSED_PERMANENTLY" &&
      p.businessStatus !== "CLOSED_TEMPORARILY",
  );

  if (openPlaces.length === 0) {
    return null;
  }

  // openPlaces preserves Google's relevance order; take the top window and
  // randomize within it.
  const pool = openPlaces.slice(0, SELECTION_POOL_SIZE);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return mapPlaceToLocation(pick);
}

/**
 * Fetches the actual image bytes for a photo reference and returns them base64-
 * encoded. The media URL (which embeds the API key) is built here, server-side,
 * so the key is never persisted or sent to a client. The 600px height matches
 * the dimension the old client-facing URL used. Returns null on any failure
 * (invalid reference, non-OK response) — callers treat that as "no image".
 */
export async function fetchPlacePhotoBytes(
  photoReference: string,
): Promise<{ base64: string; contentType: string; bytes: number } | null> {
  if (!isValidPhotoReference(photoReference)) return null;

  const url = `https://places.googleapis.com/v1/${photoReference}/media?key=${placesApiKey.value()}&maxHeightPx=600`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) }); // follows the redirect to the image bytes
    if (!res.ok) {
      console.error(`Place Photo Error: ${res.status} ${res.statusText}`);
      return null;
    }
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    return { base64: buffer.toString("base64"), contentType, bytes: buffer.length };
  } catch (err) {
    console.warn("[fetchPlacePhotoBytes] unavailable");
    return null;
  }
}

// ------------------------------
// Alternate selection strategies (not currently wired into the pipeline; kept
// for potential future use — getBestLocation is the one in use today).
// ------------------------------

/**
 * Returns information about the top location based on query text
 */
export async function getTopLocation(
  queryText: string,
): Promise<LocationInformation | null> {
  // We only need the very first result for the "top" location
  const places = await fetchPlaces(queryText, 1);

  if (places.length === 0) {
    return null;
  }

  return mapPlaceToLocation(places[0]);
}

/**
 * Returns information for a random location (non-top) based on query text
 */
export async function getRandomLocation(
  queryText: string,
): Promise<LocationInformation | null> {
  // Fetch up to 10 places so we have a good pool to pick randomly from
  const places = await fetchPlaces(queryText, 10);

  if (places.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * places.length);
  return mapPlaceToLocation(places[randomIndex]);
}
