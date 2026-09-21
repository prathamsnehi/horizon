# Cloud Function API Contracts

The app communicates with Firebase Cloud Functions over HTTPS. Each function receives a JSON request and returns a JSON response. The AI model behind each function is a backend concern — the app only cares about the contract.

All endpoints are called via Firebase's `callable` Cloud Functions SDK (not raw HTTP), which handles auth tokens and serialization automatically.

## Endpoints

---

### 1. `generateCuratedQuests`

The user's **curated batch**. Cache-first: serves a pre-generated batch from Firestore instantly when available, else generates on the spot. The batch size is **server-controlled** (3); the client does not send a count. **Requires a Firebase Auth session** — anonymous, established silently by the client (App Check also enforced). **Rate-limited server-side to 1 per 24h per user** (keyed on `request.auth.uid`) — see [Rate Limiting](#rate-limiting).

**Used by:** Initial batch after onboarding, and the daily refresh.

**Request:**

```json
{
  "profile": {
    "interests": ["string"],
    "comfortZoneEdges": ["string"],
    "vibe": ["string"],
    "experimentationLevel": 1,
    "budget": ["string"],
    "transportation": ["walking" | "publicTransport" | "car" | "bike" | "rideshare"],
    "locationPreferences": ["string"],
    "additionalContext": "string or null",
    "city": "string",
    "cityLatitude": 37.7749,
    "cityLongitude": -122.4194
  },
  "excludeTitles": ["string"]
}
```

`excludeTitles` (optional) contains titles of recently completed quests to avoid duplicates. Identity is never sent in the payload — the backend derives it from the verified Firebase Auth `uid` (which keys both the rate limits and the pre-generation cache).

`cityLatitude`/`cityLongitude` are optional. When both are present, the backend computes straight-line distance and per-mode travel-time estimates for each resolved location; when absent, distance is omitted and transportation options fall back to `0`-minute placeholders.

_Validation (before any LLM spend or rate-limit reservation): the profile's required arrays (`interests`, `comfortZoneEdges`, `vibe`, `budget`, `transportation`, `locationPreferences`) must be present and non-empty and `city` a non-empty string, all within length caps; `excludeTitles` (if present) is a bounded string array. A missing/malformed field returns `invalid-argument`._

`comfortZoneEdges` is what the user avoids — the signal the whole product is built on. Quests should be written to push against these, with `experimentationLevel` (1–5) setting how far past the edge to go.

**Caching & pre-generation:** On serve, the backend persists today's batch and enqueues a **Cloud Task** to pre-generate the next batch, so subsequent days are instant. A stored batch is invalidated when the profile changes (its hash no longer matches) or after a TTL (7 days).

**App Behavior:** The app calls this and waits. A cache hit is fast; a miss (first time, or profile changed) takes a few seconds — show a "curating" state past ~2s. (The response no longer carries per-stage timings; those are logged server-side.)

**Response:**

```json
{
    "quests": [
        {
            "title": "string",
            "questDescription": "string",
            "difficulty": "easy" | "moderate" | "hard" | "extreme",
            "estimatedActivityMinutes": 60,
            "categories": ["string"],
            "pushesComfortZoneEdges": ["string"],
            "locationInformation": {
                "name": "string",
                "address": "string",
                "locationDescription": "string",
                "latitude": 37.7694,
                "longitude": -122.4862,
                "photoReference": "string",
                "photoImageBase64": "string (optional)",
                "photoContentType": "string (optional)",
                "googleMapsURL": "string",
                "distanceMiles": 2.4,
                "transportationOptions": [
                    {
                        "mode": "walking" | "publicTransport" | "car" | "bike" | "rideshare",
                        "estimatedTravelMinutes": 15,
                        "isRecommended": true
                    }
                ]
            }
        }
    ]
}
```

**Field notes:**

- `estimatedActivityMinutes` is an integer count of minutes for the activity itself and **excludes** travel time. (Maps directly to `Quest.estimatedActivityMinutes`.)
- **`pushesComfortZoneEdges`** names which of the user's own `comfortZoneEdges` this quest targets, **ordered by weight, primary first** — dense client surfaces render only the first, so the order is load-bearing. Each entry must be one of the **exact strings the user submitted**, echoed verbatim: that's what makes it read as a receipt rather than the model's own phrasing. Keep it honest (1–3); listing every edge a quest loosely touches makes the stamp meaningless. Omitted or empty on generic quests, and the client then shows nothing.
- `locationInformation` is omitted for generic (no-location) quests — these are produced as a fallback when Maps cannot resolve enough real locations. The client should treat its absence as "at-home / location-agnostic."
- `distanceMiles` and `transportationOptions` are only meaningful when the request included `cityLatitude`/`cityLongitude`. Exactly one option has `isRecommended: true`, chosen by the Writer model. Without city coords, `distanceMiles` is omitted and `transportationOptions` come back as `0`-minute placeholders.
- **Hero image:** `photoImageBase64` is the base64-encoded image bytes (with `photoContentType`, e.g. `image/jpeg`), fetched server-side and embedded in the response — **the Maps API key is never sent to the client.** The client should decode it once, store it on the quest, and render from the stored bytes (no image URL to load). It is **absent** when the place has no photo or the fetch failed → show a placeholder. `photoReference` is the durable Places photo handle used server-side; clients can ignore it.

_Note: If the Google Maps API fails to return a specific location field (e.g., the place has no photo), that field safely defaults to an empty string `""` (or `0` for coordinates); `photoImageBase64`/`photoContentType` are simply omitted._

---

### 2. `generateUserDescribedQuest`

Generate **one** quest tailored to a freeform user prompt. The backend first plans whether the request needs a real place (→ Maps + location writer) or is location-agnostic (→ generic writer), falling back to generic if Maps can't resolve. **Requires a Firebase Auth session** — anonymous, established silently by the client (App Check also enforced). **Rate-limited server-side to 1 per 24h per user** (independent of the curated window) — see [Rate Limiting](#rate-limiting).

**Used by:** The "Describe your own" daily action on the Explore tab.

**Request:**

```json
{
  "prompt": "string (the user's freeform description)",
  "profile": { "...": "a full UserProfile (see generateCuratedQuests)" }
}
```

**Response:**

```json
{
  "quest": {
    "title": "string",
    "questDescription": "string",
    "difficulty": "easy" | "moderate" | "hard" | "extreme",
    "estimatedActivityMinutes": 60,
    "categories": ["string"],
    "locationInformation": { "...": "present only when the quest is tied to a real place" }
  }
}
```

Note the response is a **single `quest` object** (not an array). The client sets `origin = .described` and stores the user's `prompt` in `userPrompt`.

**Rate limiting:** 1 per 24h per user (see [Rate Limiting](#rate-limiting)). The prompt is trimmed and capped (max 300 chars) and passes a lightweight moderation check — an empty/oversized/blocked prompt returns `invalid-argument` **before** any spend or slot reservation.

---

### 3. `generateGetStartedGuide` — ⚠️ NOT YET IMPLEMENTED

Generate a step-by-step guide for approaching a specific quest. Called on demand when the user taps "Get Started." The request/response shapes are defined in the backend's `types.ts` (`GetStartedRequest` / `GetStartedResponse`), but the handler is **not yet wired up** — do not depend on this endpoint until the backend confirms it is live.

**Request:**

```json
{
  "quest": {
    "...": "a full QuestItem (see the generateCuratedQuests response)"
  },
  "profile": {
    "...": "a full UserProfile (see the generateCuratedQuests request)"
  }
}
```

**Response:**

```json
{
  "steps": ["Step 1 description", "Step 2 description", "Step 3 description"]
}
```

---

## Error Handling

Errors are surfaced as Firebase `HttpsError`, so the client receives a standard `{ code, message, details? }` via the callable SDK. Codes emitted:

- `unauthenticated` — no Firebase Auth session on the request. Not user-actionable: the client always establishes its anonymous session before calling, so this means something went wrong. Message: "Couldn't verify this device. Please try again."
- `invalid-argument` — the payload failed validation (missing/malformed fields, oversized/empty prompt), or a described prompt was blocked by moderation. The message text is user-surfaceable.
- `resource-exhausted` — the per-user 24h rate limit was hit. Carries a **`details`** object: `{ retryAt: <ISO8601>, scope: "curated" | "described" }`. The message is a friendly "come back tomorrow"; the client reads `details.retryAt` for its countdown.
- `internal` — generation failed downstream (e.g., Scout produced no concepts, or the Writer produced nothing). Show a retry button. A failed generation does **not** consume the daily slot.

_Both callables enforce **App Check** (`enforceAppCheck: true`) **and** require a Firebase Auth session (anonymous is fine — the handler only reads `request.auth.uid` and doesn't care how it was minted). App Check failures are rejected by Firebase before the handler runs; the missing-auth check is the first thing the handler does._

The client should also handle transport-level failures (no network) as its own offline state, independent of these server codes.

## Rate Limiting

Enforced **server-side**, per **`request.auth.uid`** (the verified Firebase Auth token — never a payload field, which is spoofable), on a **24h rolling window** using **server time**:

- `generateCuratedQuests` — **1 per 24h**.
- `generateUserDescribedQuest` — **1 per 24h**, independent window.

State lives in `rateLimits/{uid}`: per-lane **durable stamps** (`lastCuratedAt` / `lastDescribedAt`) plus per-lane **pending reservations** (`pendingCuratedAt` / `pendingDescribedAt`, TTL **90s**). Inside a Firestore transaction, before generation: blocked if `lastAt` is within 24h (`retryAt = lastAt + 24h`), else blocked if `pendingAt` is within 90s (`retryAt = pendingAt + 90s` — this is also what stops concurrent duplicates), else `pendingAt = now` is written. **Only on success** is `lastAt` stamped (and `pendingAt` cleared) — the 24h window starts when quests are actually delivered. On failure the pending stamp is cleared best-effort, and if the process dies (e.g. platform timeout kills the run) the TTL frees it within 90s — **a server failure costs the user at most ~1.5 minutes, never the daily slot**. This is deliberately *not* reserve-then-rollback: rollback code only runs if the function survives. Both generation callables run with `timeoutSeconds: 60` (the pending TTL must stay ≥ the function timeout so a still-running generation can't be double-entered).

On denial the handler throws `resource-exhausted` with `details.retryAt` (ISO8601 — `lastAt + 24h` for a spent window, `pendingAt + 90s` for an in-flight/just-failed run) and `details.scope`. The client reads `retryAt` for its recharge countdown in both cases.

_There is no client-sent identifier: the verified `uid` keys the pre-generation cache too, so one install has one cache and one daily quota. The session is keychain-backed, so it survives relaunches (and usually reinstalls), but it does not follow the user to a second device._

_**Developer exemption:** if `rateLimits/{uid}` has `exempt == true`, both window checks are skipped (success still stamps `lastAt`). It's set by hand in the Firestore console on the developer's own uid — clients can never write it (rules are default-deny). The uid is anonymous and per-install, so re-set the flag whenever the dev's install gets a new one (a fresh install on a wiped keychain). The iOS client keeps its local 24h gate in **all** builds, so an exempt uid still sees the client-side recharge plate — clear app data or wait it out when testing._

_This is unrelated to the multi-provider LLM router, which applies its own free-tier-aware distribution across providers (see "Multi-provider LLM routing") to avoid provider 429s — infrastructure, not a user-facing limit._

## Backend orchestration — what's behind the endpoint

None of this is visible to the app, which only ever sees the contract above. Recorded because the shape of the response follows from it.

**Two passes over an LLM router, with Maps in between.** A **Scout** pass turns the profile into location concepts, each tagged with an `intendedDifficulty`. Those concepts go to **Google Places `searchText`** in parallel; closed places are dropped and the function picks at random among the top few results, so quests are popular-but-varied rather than always the identical #1. Distance and per-mode travel times are then computed locally (Haversine + heuristics) when the request carried city coords. A **Writer** pass gets the profile plus the resolved places and writes the quests, choosing an `assignedLocationId` per quest — **the backend re-attaches the real Maps data by ID afterward**, so the model can never corrupt an address or a coordinate. If fewer places resolved than the batch size, the shortfall is filled with location-agnostic quests, which come back without `locationInformation`.

**Photos are fetched at serve time, never cached.** Places returns a durable photo *reference*, which is what the pre-generated batch stores; the bytes are fetched server-side on each serve and embedded as base64. Firestore's 1 MB limit and the Places content policy both rule out persisting the image. A failed fetch just omits it. This costs a cache hit ~0.5–1s.

**The LLM router is provider-agnostic** — Gemini primary, with Groq/Mistral/Cerebras behind it, all free-tier, structured output validated with Zod. A Firestore-backed per-minute/per-day limiter spreads load to stretch each free quota, and failover drops to the next provider on a rate-limit, transient, or schema error, draining the failed model's window so later calls route elsewhere. It fails open on a static priority order, so generation never blocks on the limiter. Per-stage latency and the chosen model land in a **PII-free `logs`** collection — no profile, prompt, response, or device id.

**Keys never reach the client.** All provider keys and the Maps key live in Secret Manager; every Places call (search and photo fetch) is server-side, and responses carry image bytes rather than a URL or a key.

## Image handling on the app side

- The hero image arrives **inside the quest response** as `photoImageBase64` — no image URL, no key, no separate network fetch for it.
- The app **decodes it once** (`Data(base64Encoded:)`) and **stores the `Data` on the quest** (`@Attribute(.externalStorage)`), rendering from those bytes thereafter — offline, and instant on repeat views.
- The bytes live and die with the quest, including after completion, since the logbook renders the same hero image. No separate download cache to manage; `PhotoCache` only memoizes the *decode*, because SwiftUI bodies re-run.
- If `photoImageBase64` is absent (no photo, or the server-side fetch failed), the client shows a bundled placeholder — the same one non-location quests use.
