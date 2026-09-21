# Backend architecture

Horizon's backend is Firebase Cloud Functions gen 2 on Node 22 and TypeScript.
It exposes two authenticated quest callables, a Cloud Tasks worker that prepares
the next curated batch, and an unauthenticated aggregate marketing-metrics
endpoint. `functions/src/index.ts` is the deployed export surface.

## Boundaries

The quest path follows **Controller -> Service -> Integration**:

- `controllers/` owns Firebase triggers, Auth/App Check assumptions, payload
  validation, per-user reservations, and `HttpsError` mapping.
- `services/questService.ts` orchestrates generation using plain inputs and
  outputs.
- `integrations/` wraps Firestore and Google Places.
- `llm/` owns model selection, structured output, provider quotas, and failover.
- `observability/` records one de-identified trace for each wrapped generation.
- `utils/` contains pure validation, prompt, distance, hash, and reservation
  logic.

Keep Firebase and vendor concerns at the edges. New business rules should
normally be expressible and testable without a live Firebase project.

## Curated request flow

1. Firebase enforces App Check; the controller requires `request.auth` and uses
   only its verified UID.
2. Validate the profile and optional excluded titles before any reservation or
   external call.
3. Reserve the curated lane in `user_rate_limits/{uid}`.
4. Read `pregen_cache/{uid}`. Use it only when it has quests, its profile hash
   matches, and it is younger than `BATCH_TTL_MS`.
5. On a miss, run Scout -> Places lookups in parallel -> local distance and
   transport estimates -> Writer. Fill any deficit with generic quests.
6. Clear the consumed cache state and enqueue `pregenerateCuratedBatch`, which
   builds and stores the *next* reference-only batch. Enqueue failure is
   deliberately best-effort; the next request can generate synchronously.
7. Attach Places photo bytes to the response best-effort while committing the
   durable rate-limit stamp. The cache and trace result never contain base64.
8. Before the request settles, `runTrace` persists its sample unless moderation
   marked the prompt as blocked.

`generateUserDescribedQuest` uses the same validation, reservation, photo, and
commit boundaries. A planner chooses a location or generic path; unresolved
locations and empty location-writer output fall back to one generic quest. It is
not pre-generated.

## Storage and limits

- `user_rate_limits/{uid}`: independent curated and described lanes. A pending
  stamp blocks concurrent work for 90 seconds; a durable stamp starts the
  rolling 24-hour window only on successful delivery. Developer exemptions come
  from `RATE_LIMIT_EXEMPT_UIDS` in Secret Manager and bypass all three phases.
- `pregen_cache/{uid}`: regenerable next-batch cache keyed by a profile hash.
  Entries contain quest metadata and Places photo references, with a 60-day
  application/native-TTL horizon.
- `llm_rate_buckets/global`: per-model multi-window request accounting. If the
  transaction fails, routing uses static priority order rather than blocking a
  generation. Provider failures penalize that model before failover.
- `generation_samples/{autoId}`: de-identified pipeline samples; see
  [observability.md](./observability.md).
- `site_metrics/{UTC-date}`: aggregate pageview, visit, download, referrer-host,
  and device-class counters for the website.

Firestore client rules permit an authenticated user to read only their own
`admins/{uid}` record, and allow listed admins to read generation samples and
site metrics. All other backend collections remain server-only through the
Admin SDK.

## External dependencies and failure posture

The LLM router chooses per-stage candidates across configured providers using
rate headroom, with schema-validated structured output. SDK retries remain off;
the router owns failover. Provider limits and model identifiers are operational
configuration that must be checked against current provider consoles before
being changed.

Google Places Text Search returns place metadata and a durable photo reference.
Photo media is fetched server-side at serve time so the API key never reaches a
client and image bytes are not persisted. Closed places are filtered and a
result is selected from the top relevance window for variety.

The system favors useful partial results over request failure: Maps misses are
dropped, generic quests fill batch gaps, photo failures omit an image, pre-gen
enqueue failures become a later synchronous miss, and observability failures do
not affect the response.

## Deployment and configuration

All provider keys and the developer exemption list live in Secret Manager.
Declaring a secret in `config.ts` is insufficient: each function that reads it
must bind it in its trigger options.

Changes to `functions/`, `firebase.json`, or `.firebaserc` on `main` trigger the
production functions workflow. It installs from `functions/yarn.lock`, builds,
authenticates with the repository service account, and deploys to
`horizon-sidequests`. There is no staging deployment, and CI currently does not
run the Jest suite.
