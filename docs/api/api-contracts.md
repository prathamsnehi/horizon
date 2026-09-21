# Cloud Function API contracts

This is the single source of truth for the boundary between the iOS app and the
Firebase backend. The implementation lives in `functions/src/types.ts`,
`functions/src/controllers/quests.ts`, and
`ios/horizon/Core/Services/CloudFunctionService.swift`.

Both endpoints are Firebase callable functions rather than raw HTTP endpoints.
The iOS client silently establishes an anonymous Firebase Auth session before a
call; Firebase supplies the verified token and serialization. Both functions
also enforce App Check.

## Shared profile payload

```json
{
  "interests": ["string"],
  "comfortZoneEdges": ["string"],
  "vibe": ["string"],
  "experimentationLevel": 1,
  "budget": ["string"],
  "transportation": ["walking", "publicTransport", "car", "bike", "rideshare"],
  "locationPreferences": ["string"],
  "additionalContext": "string or null",
  "city": "string",
  "cityLatitude": 44.9537,
  "cityLongitude": -93.0900
}
```

The six array fields and `city` are required and non-empty.
`experimentationLevel` must be numeric. Coordinates are optional but, when
present, must be finite numbers. Validation caps are defined in
`functions/src/utils/validation.ts`; validation runs before rate-slot
reservation, model calls, or Places calls.

Identity is never part of the payload. The backend uses `request.auth.uid` for
the daily limit and pre-generation cache.

## Quest shape

```json
{
  "title": "string",
  "questDescription": "string",
  "difficulty": "easy | moderate | hard | extreme",
  "estimatedActivityMinutes": 60,
  "categories": ["string"],
  "pushesComfortZoneEdges": ["string"],
  "locationInformation": {
    "name": "string",
    "address": "string",
    "locationDescription": "string",
    "latitude": 44.9537,
    "longitude": -93.0900,
    "photoReference": "places/.../photos/...",
    "photoImageBase64": "optional base64 bytes",
    "photoContentType": "optional MIME type",
    "googleMapsURL": "string",
    "distanceMiles": 2.4,
    "transportationOptions": [
      {
        "mode": "walking | publicTransport | car | bike | rideshare",
        "estimatedTravelMinutes": 15,
        "isRecommended": true
      }
    ]
  }
}
```

- `estimatedActivityMinutes` excludes travel time.
- `pushesComfortZoneEdges` is optional. Location-backed quests contain one to
  three exact strings from the request, ordered primary first; generic quests
  omit it and the client decodes that as `[]`.
- `locationInformation` is optional and omitted for location-free quests.
- `distanceMiles` is optional. Transportation estimates use zero-minute
  placeholders when city coordinates were not supplied.
- `photoReference` is a durable server-side Places handle. The iOS decoder
  ignores it.
- Photo bytes are attached to the response only. The app decodes them once into
  `Quest.locationPhotoData`; the Maps key and a fetchable image URL never reach
  the client. Missing bytes mean the client displays its bundled placeholder.

## `generateCuratedQuests`

Returns a server-sized personalized set, nominally three quests.

Request:

```json
{
  "profile": { "...": "shared profile payload" },
  "excludeTitles": ["optional recent quest titles"]
}
```

Response:

```json
{
  "quests": [{ "...": "quest shape" }]
}
```

`excludeTitles` is optional and capped by server validation. The client must
render however many quests are returned; partial location resolution can yield
fewer location-backed quests and generic quests fill the remaining capacity.

The endpoint checks `pregen_cache/{uid}` for a next batch built for the exact
profile. A usable batch must match the profile hash and be younger than 60 days.
On a hit, it is consumed; on a miss, the batch is generated synchronously. In
both cases the consumed cache entry is cleared and a best-effort Cloud Task is
enqueued. That task—not the serving request—stores the following reference-only
batch. Photo bytes are fetched only while serving and are never cached in
Firestore.

## `generateUserDescribedQuest`

Returns one quest derived from a freeform request.

Request:

```json
{
  "prompt": "string",
  "profile": { "...": "shared profile payload" }
}
```

Response:

```json
{
  "quest": { "...": "quest shape" }
}
```

The prompt is trimmed, must be non-empty, and is limited to 300 characters. A
lightweight safety blocklist runs before spend or rate-slot reservation. The
backend plans whether the request needs a place, falls back to a generic quest
when Places cannot resolve one, and never caches described quests. The client
stores these with `origin = .described` and retains the user's prompt locally.

## Errors

Firebase surfaces errors through the callable SDK as `{ code, message,
details? }`.

| Code | Meaning and client behavior |
| --- | --- |
| `unauthenticated` | The Firebase Auth token is missing. Backend message: `Sign in to generate quests.` The normal iOS path establishes anonymous auth first, so treat this as a session/server error. |
| `invalid-argument` | Payload validation failed or a described prompt was blocked. The message is suitable for the client error surface. |
| `resource-exhausted` | The daily lane is spent or a generation is already pending. `details` is `{ retryAt: <ISO8601>, scope: "curated" | "described" }`. |
| `internal` | Generation failed downstream. The durable daily slot is not consumed; the pending reservation is released best-effort or expires. |

Network loss and the client's 90-second transport timeout are client-side error
states, not additional function codes.

## Rate limiting

The two endpoints have independent rolling 24-hour windows keyed by the verified
`request.auth.uid`. State lives in `user_rate_limits/{uid}` and uses server time.

1. A Firestore transaction writes a lane-specific pending stamp before spend.
2. A fresh pending stamp blocks concurrent work for up to 90 seconds.
3. Successful delivery writes the durable stamp and clears the pending stamp.
4. Failure clears the pending stamp best-effort; process death leaves only the
   self-expiring pending stamp, never a burned daily window.

Developer exemptions come from the comma-separated `RATE_LIMIT_EXEMPT_UIDS`
Secret Manager value. There is no client-writable exemption field. See
[`../operations/secrets.md`](../operations/secrets.md).

## Backend-only behavior

Provider routing, Maps lookup, pre-generation, photo attachment, and generation
telemetry are implementation details rather than client contract fields. The
pipeline is documented in [`../backend/architecture.md`](../backend/architecture.md).

`GetStartedRequest` and `GetStartedResponse` types exist in TypeScript, but no
`generateGetStartedGuide` function is exported. The iOS UI therefore presents
Get Started as deferred behavior and must not call that endpoint.
