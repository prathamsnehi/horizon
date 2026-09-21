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
