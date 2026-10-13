# Generation observability

Each generation wrapped by `runTrace` attempts to write one de-identified
document to `generation_samples`. The same record supports failure diagnosis,
pipeline latency analysis, provider-failover inspection, and offline quality
evaluation. A trace-write failure never changes the generation result.

Do not describe this corpus as legally anonymous. It has no stable identity,
but it retains product signals such as city and preferences that may be unusual
in combination.

## Record shape

```text
generation_samples/{autoId}
  traceId
  type                 curated | described | pregen
  startedAt
  totalLatencyMs
  outcome              success | error | rate_limited | invalid
  error?               message for failed work
  spans[]              ordered stage, offset, latency, input/output, metadata
  result?              reference-only generated quest data
```

Authentication and App Check rejection happen before `runTrace`, so they do not
create samples. Validations and user rate-limit denials inside the trace do.
Moderation-blocked described prompts are explicitly excluded: no document is
written for them.

## Privacy boundary

The corpus must not contain:

- UID, device ID, or any other stable user/session identifier;
- profile or cache hashes that could link multiple samples;
- `additionalContext` or rendered LLM prompts;
- photo base64 or other large media bytes;
- the text of a moderation-blocked prompt.

`sanitizeProfile` drops `additionalContext`, coarsens coordinates to two decimal
places, and scrubs contact-shaped text from comfort-zone edges. Described
prompts pass through `scrubText`, which removes common email, phone, URL, and
handle patterns. That scrubbing is a best-effort floor, not a guarantee; profile
fields such as interests, vibes, and city remain useful but potentially
identifying in rare combinations.

Any new capture site containing user-authored data must go through the
sanitization boundary and receive a focused test. Never put arbitrary request
objects directly into a span.

## Implementation and access

`AsyncLocalStorage` holds the active trace, allowing deep service, integration,
and routing code to add spans without threading a context parameter throughout
the pipeline. It is safe for concurrent gen-2 requests and is a no-op outside a
trace, including most unit tests.

`runTrace` stamps the final outcome and awaits `saveGenerationSample` in a
`finally` block. Firestore serialization strips `undefined`; persistence is
best-effort. No retention TTL is configured in this repository.

The `/admin` dashboard in `hosting/` reads generation samples and aggregate site
metrics directly through the Firestore client SDK. Access is enforced by
Firestore rules using the existence of `admins/{uid}`; clients cannot write the
samples or metrics. The Firestore console is the fallback diagnostic reader.

## Known limitation

The backend does not receive whether a generated quest was accepted or
completed. The corpus can reveal generation quality and system health, but it
cannot measure user outcomes. Any future feedback signal needs an explicit
privacy design before collection; do not add UID to these samples to obtain it.

## Luna/Groq gateway telemetry

Existing span and `attemptLog` fields remain readable for historical traces.
Provider names are now `tokenrouter` or `groq`; semantic stages remain Scout,
planner, Writer, and generic. Failed gateway stages emit an attempt span too,
so their usage is not lost. Optional attempt fields are `usage` (input/output/
total tokens), `estimatedCostUsd`, and `unknownUsage`. Missing usage is unknown,
not zero; estimates use published model rates and are not wallet reconciliation.

Stage metadata adds `capacityWaitMs` and `fallbackReason`. A capacity-triggered
Groq call can have only one dispatched attempt and still counts as failover.
Provider error bodies and SDK diagnostics never enter traces; errors are reduced
to safe status/category codes. Admission/job/reservation IDs, UID, and stable
profile hashes remain server-only and are not included in trace metadata.
Temporary provider congestion uses outcome `rate_limited` with a stage reason;
HTTP callable `unavailable` remains distinct from the daily allowance code.
The admin cost tile sums priced attempts in loaded samples and identifies
unpriced attempts, including older traces. Truncation/missing samples and
unknown-usage failures make it unsuitable as a billing ledger.

Trace persistence is awaited for at most two seconds. A slow/failing write is
best-effort so it cannot indefinitely hold a completed generation response.
Pre-generation registration/queueing similarly has a three-second foreground
budget; a late older registration cannot supersede a newer delivery's job.
