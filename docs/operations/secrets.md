# Secrets

Backend provider keys and privileged configuration live in Google Cloud Secret
Manager. Do not add a Functions `.env` file: CI cannot see local files, and every
deployed function can read only the secrets explicitly attached to it.

## Managed values

| Secret | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Primary model provider |
| `GROQ_API_KEY` | Model fallback |
| `MISTRAL_API_KEY` | Model fallback |
| `CEREBRAS_API_KEY` | Model fallback |
| `PLACES_API_KEY` | Server-side Google Places search and photo retrieval |
| `RATE_LIMIT_EXEMPT_UIDS` | Comma-separated development UIDs that skip user generation windows |

The authoritative declarations are in `functions/src/config.ts`. Function-level
bindings are in the controller definitions.

## Set or inspect a value

Run production commands only when explicitly requested:

```bash
npx firebase-tools@14 functions:secrets:set RATE_LIMIT_EXEMPT_UIDS --project horizon-sidequests
npx firebase-tools@14 functions:secrets:access RATE_LIMIT_EXEMPT_UIDS --project horizon-sidequests
npx firebase-tools@14 functions:secrets:prune --project horizon-sidequests
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
