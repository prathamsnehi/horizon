# Secrets

Backend provider keys and privileged configuration live in Google Cloud Secret
Manager. Do not add a Functions `.env` file: CI cannot see local files, and every
deployed function can read only the secrets explicitly attached to it.

## Managed values

| Secret | Purpose |
| --- | --- |
| `TOKENROUTER_API_KEY` | Luna primary, reasoning disabled |
| `GROQ_API_KEY` | Independent foreground-only GPT-OSS 120B fallback |
| `PLACES_API_KEY` | Server-side Google Places search and photo retrieval |
| `RATE_LIMIT_EXEMPT_UIDS` | Comma-separated development UIDs that skip user generation windows |

Both callables bind TokenRouter, Groq, Places, and the exemption list. The
background worker binds only TokenRouter and Places. Old Gemini, Mistral, and
Cerebras cloud secrets are no longer bound; this migration does not delete or
rotate them. No secret value is printed for testing: load ignored local files
inside Node or use the evaluation runner's memory-only CLI reader.

The authoritative declarations are in `functions/src/config.ts`. Function-level
bindings are in the controller definitions.

## Set or inspect a value

Run production commands only when explicitly requested:

```bash
firebase functions:secrets:set RATE_LIMIT_EXEMPT_UIDS --project horizon-sidequests
firebase functions:secrets:access RATE_LIMIT_EXEMPT_UIDS --project horizon-sidequests
firebase functions:secrets:prune --project horizon-sidequests
```

A secret must exist before a non-interactive deployment can bind it. After
changing a value, redeploy the consuming functions for the new version to take
effect.

Adding a new secret requires both steps:

1. Declare it with `defineSecret` in `functions/src/config.ts`.
2. Include it in the `secrets` option of every function that reads it.

Missing the second step produces an unavailable value at runtime even when the
secret exists in Secret Manager.

## Development rate-limit exemption

The iOS client uses anonymous Firebase Auth. Find the current development
install's UID in Firebase Authentication, then place that UID in
`RATE_LIMIT_EXEMPT_UIDS`; comma-separate multiple UIDs. An empty value exempts
nobody.

The exemption bypasses the backend's pending and durable rate stamps. It does
not disable provider or Places quotas, and it does not bypass the iOS client's
own UX gate. There is no Firestore `exempt` field.

## Public Firebase configuration

`hosting/src/lib/firebase.ts` and `ios/horizon/GoogleService-Info.plist` identify
the Firebase project and are intentionally committed. They are not authorization
credentials. Security comes from Auth, App Check, Firestore rules, and API-key
restrictions. Browser-key restriction guidance lives in
[`admin-dashboard.md`](admin-dashboard.md).

## Luna migration rollout

Before an explicitly authorized deployment, provision `TOKENROUTER_API_KEY`,
verify Luna access and Groq strict output using synthetic inputs, and confirm
account RPM/concurrency (including traffic from other keys). Current application
limits live in `functions/src/llm/admission.ts`. The tested account returned a
15-request/minute ceiling; balance-dependent concurrency is separate. The app
starts at 12 RPM and three concurrent Luna calls. Estimated spending is visible
in generation traces/admin; there is no daily spend cap. Existing Firebase CLI
and tools suffice; notify the user before installing dependencies or tools.
