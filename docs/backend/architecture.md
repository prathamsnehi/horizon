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
   matches, it is younger than `BATCH_TTL_MS`, and current excluded titles do not
   conflict with its quests.
5. On a miss, run Scout -> Places lookups in parallel -> local distance and
   transport estimates -> Writer. Fill any deficit with generic quests.
6. Attach Places photo bytes best-effort. Atomically commit the owning daily
   reservation and consume exactly the cached batch version read (when used).
7. Register and enqueue the next reference-only batch after commit. Enqueue
   failure/three-second timeout is best-effort; the next request can generate synchronously.
8. `runTrace` persists its sample before settling, unless moderation blocked it.

`generateUserDescribedQuest` uses the same validation, reservation, photo, and
commit boundaries. A planner chooses a location or generic path; unresolved
locations and empty location-writer output fall back to one generic quest. It is
not pre-generated.

## Storage and limits

- `user_rate_limits/{uid}`: independent curated and described lanes. A pending
  stamp and owner ID block concurrent work for 90 seconds; a durable stamp starts
  the rolling 24-hour window only on successful delivery. Commit/release check
  ownership so an expired invocation cannot modify a newer reservation. Developer exemptions come
  from `RATE_LIMIT_EXEMPT_UIDS` in Secret Manager and bypass all three phases.
- `pregen_cache/{uid}`: regenerable next-batch cache keyed by a profile hash.
  Entries contain quest metadata and Places photo references, with a 60-day
  application/native-TTL horizon. The newest pre-generation job has an ID,
  profile hash, one-hour expiry, status, and a 90-second worker lease. Only that
  job's current worker may publish. Duplicate ready jobs are acknowledged; an
  older worker cannot overwrite a newer batch.
- `ai_gateway_state/{tokenrouter|groq}`: rolling-minute request starts, expiring
  call leases, UTC-day request count, shared cooldown/recovery-probe state, and
  observed Groq token headroom. Admission is transactional and fails closed.
  Old `llm_rate_buckets/global` data is unused; no cloud data deletion is required.
- `generation_samples/{autoId}`: de-identified pipeline samples; see
  [observability.md](./observability.md).
- `site_metrics/{UTC-date}`: aggregate pageview, visit, download, referrer-host,
  and device-class counters for the website.

Firestore client rules permit an authenticated user to read only their own
`admins/{uid}` record, and allow listed admins to read generation samples and
site metrics. All other backend collections remain server-only through the
Admin SDK.

## External dependencies and failure posture

The gateway uses one fixed primary and one foreground fallback:

- TokenRouter `openai/gpt-6-luna`, reasoning disabled, via its `.com` endpoint.
- Direct Groq `openai/gpt-oss-120b`, low reasoning, strict structured output.
- `generateText` + `Output.object` validates every stage. Planner `textQuery`
  is required and nullable internally; null is normalized to omitted for Maps.
- Every attempt caps completion at 4,096 tokens and time at 20 seconds. SDK
  retries are disabled. AI/Places work shares a 60-second absolute deadline;
  functions time out at 75 seconds, pending reservations at 90 seconds, and iOS
  transport at 90 seconds. Maps searches cap at eight seconds; photos at three.

Luna admission defaults to 12 starts per rolling minute and three concurrent
calls globally. Background starts are additionally capped at four/minute and
one concurrent call, reserving most capacity for foreground work. Foreground
waits at most two seconds for Luna capacity, then tries Groq once. Groq admits
one concurrent call with 27/minute and 900/UTC-day request ceilings. Observed
response headers inform token headroom/reset; estimates and upstream 429s are
backstops, not a claim of exact tokenizer accounting. Every attempted dispatch
consumes request capacity, including failures; a coordination timeout may leave
a conservative unused reservation until its lease expires.

Fallback applies only to capacity denial, 429, network/timeouts, or 5xx.
Authentication, billing, request/schema, and invalid-output errors fail visibly.
Storage failure prevents calls to either provider. Shared cooldown honors
`Retry-After`; defaults are 60 seconds for 429 and 30 seconds for transient
failure. After cooldown, one recovery probe may run until success or failure.
Provider limits are separate from daily user allowances, and dev exemptions do
not bypass them. Published concurrency depends on account balance; confirm
actual account limits and other account traffic before rollout.

Pre-generation uses Luna only with one concurrent Cloud Tasks dispatch. It
rethrows transient/capacity errors for up to five attempts, with 60–300 second
backoff and a one-hour retry horizon; permanent failures end the job. It never
uses Groq. At-least-once delivery can repeat paid work after a crash, but bounded
retries and owner-checked publication prevent duplicate/stale cache writes.

If both foreground providers are unavailable, return `unavailable` with a safe
reason and optional retry time, releasing the daily reservation. An in-progress
request uses the same temporary-error category. `resource-exhausted` is reserved
for the genuine 24-hour allowance. iOS temporary errors do not advance the local
daily gate. Valid Writer quests survive a failed generic deficit-fill stage.

Token usage, unknown-usage attempts, capacity waits, fallback reasons, and cost
estimates are recorded per attempt. The admin dashboard sums known estimates
across loaded samples. Pricing estimates are not reconciled billing; there is
no hard daily spending cap.

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
