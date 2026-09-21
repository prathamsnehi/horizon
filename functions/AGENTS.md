# Backend agent guide

This file applies to `functions/`. The package is the Firebase Cloud Functions
backend for Horizon: two client-facing quest callables, one Cloud Tasks worker,
and the marketing site's aggregate metrics endpoint.

## Read only what the task needs

- Request/response or error-shape changes: `../docs/api/api-contracts.md`
- Pipeline, storage, routing, or rate-limit changes:
  `../docs/backend/architecture.md`
- Trace capture, privacy, or dashboard-data changes:
  `../docs/backend/observability.md`
- Secrets or production configuration: `../docs/operations/secrets.md`
- Deferred backend work: `../docs/roadmap/backend.md`

The code is authoritative when a document disagrees with it. Update the
canonical document in the same change rather than adding another copy.

## Structure

- `src/controllers/`: Firebase entrypoints, authentication, validation, and
  `HttpsError` mapping.
- `src/services/`: framework-light quest orchestration.
- `src/integrations/`: Firestore and Google Places access.
- `src/llm/`: model registry, rate-aware routing, schemas, and LLM tasks.
- `src/observability/`: request-scoped tracing and de-identification.
- `src/utils/`: pure validation, hashing, distance, prompt, and rate-limit logic.
- `src/index.ts`: the complete deployed export surface.

Keep the Controller -> Service -> Integration boundary. Put provider-specific
details behind `integrations/` or `llm/`, and prefer pure helpers that can be
tested without Firebase or network access.

## Commands

Use Node 22, matching `package.json` and CI. Dependencies use the Yarn v1 lock;
do not create a `package-lock.json`.

```bash
corepack yarn install --frozen-lockfile
corepack yarn test --runInBand
corepack yarn build
```

The Jest suite mocks Firestore, model providers, and HTTP calls. Do not make
live AI or Places requests from unit tests. The functions deployment workflow
builds but does not run tests, so run both test and build locally.

Pushing a change under `functions/`, `firebase.json`, or `.firebaserc` to `main`
deploys production automatically. There is no staging project. Do not run a
manual deploy or change cloud configuration unless the user explicitly asks.

## Load-bearing invariants

- Derive identity only from `request.auth.uid`; never accept a UID or device ID
  in a payload. Client callables require both Auth and App Check.
- Validate the complete payload before reserving a user slot or calling a paid
  dependency.
- User limits use a two-phase reservation: a short pending stamp before work and
  a durable 24-hour stamp only when a response is delivered. Keep
  `PENDING_TTL_MS` at least as long as the effective function timeout.
- A consumed pre-generation batch is cleared and the next batch is produced by
  `pregenerateCuratedBatch`. Cached quests contain Places references, never
  photo bytes; base64 photos are attached best-effort to the response only.
- Preserve partial success. Missing Places results or a short Writer result are
  filled with generic quests; a failed photo fetch omits the image.
- The LLM quota store fails open to static candidate order. Provider SDK retries
  stay disabled so router failover, rather than a hidden retry loop, handles
  transient/provider failures.
- Secrets are `defineSecret` values and must also appear in every consuming
  function's `secrets` option. Never add keys or exemption UIDs to source files.
- `generation_samples` is de-identified but still sensitive. Never record UID,
  stable profile hashes, `additionalContext`, rendered prompts, or photo base64.
  Moderation-blocked prompts must produce no sample. Pass new user-authored trace
  fields through the sanitization boundary and document what remains.
- `trackEvent` stores aggregate daily counters only: no IP, cookie, UID, or
  per-visitor/session record.

## Finishing a change

- If an exported callable or wire type changes, update the canonical API
  contract and the corresponding iOS call site/decoder in the same change.
- Add focused tests beside the existing `src/tests/` suites; favor pure behavior
  tests over broad Firebase mocks.
- Run the Jest suite and TypeScript build. Note any check that could not run.
- Re-check Secret Manager bindings, Firestore collection names, privacy fields,
  and the cache/rate-limit ordering whenever those paths are touched.
