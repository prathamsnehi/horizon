# Security Posture

How the generation backend is protected from abuse. The console steps still
outstanding live in `docs/milestones.md`.

## Mental model

Two goals, and most people only do the first:

1. **Make abuse not worth it** — raise the cost of a free generation above its
   value (a verified session + App Check + server-side limits).
2. **Cap the blast radius** — make a breach unable to hurt you, i.e. the bill
   can't explode (billing budget + `maxInstances`).

## In place

**Identity & access**
- **Anonymous Firebase Auth** (`AnonymousSession`) — no sign-in screen, no Apple
  ID, no prompt. The session is minted lazily on the first Cloud Function call
  and persists in the keychain across launches (and usually reinstalls).
- **Why a session at all, when App Check is enforced?** Because App Check
  identifies the *app*, not the install: its `app_id`/`sub` claim is byte-identical
  on every device running Horizon. It proves the caller is the genuine unmodified
  binary on real Apple hardware — it cannot tell two users apart, so it can't key
  a per-user quota. The anon uid can, and unlike a client-generated device ID it
  arrives as a **verified ID token** rather than spoofable payload.
- **What this trades away**, knowingly: the quota no longer follows an Apple ID,
  so it's per-install rather than per-person. Deliberate — the app is built for
  one person on one device.
- **No account deletion requirement.** App Store Guideline 5.1.1(v) covers apps
  supporting account *creation*; there is no user-facing account here. Settings
  offers "Delete all data" (`LocalDataReset`), which wipes profile + quests
  and returns to onboarding. It deliberately **does not** delete the anon Firebase
  user — that would mint a fresh uid and hand out a fresh 24h quota, turning the
  reset button into a rate-limit bypass.
- Generation calls use the Firebase **Callable** API, so the Auth ID token and
  App Check token ride on every call automatically. The backend rejects missing
  auth (`unauthenticated`) and enforces `enforceAppCheck: true`.

**Rate limiting** — the real gate is server-side: a 24h rolling window on
**server time**, keyed on `request.auth.uid` (nothing client-supplied), separate
windows for curated vs. described, enforced in a Firestore transaction with a
90s pending reservation so a crashed run can't burn a user's day. Full design:
`docs/architecture/03-api-contracts.md#rate-limiting`.

The client's `GenerationLimit` is **UX gating only** — it dims the base card's
actions and shows a recharge time, and reconciles to the server's
`resource-exhausted` + `details.retryAt` so the two never disagree.

**Input validation** — validated on both sides, backend authoritative, and
checked *before* any LLM spend or slot reservation. `ValidationLimits` mirrors
the backend caps: describe prompt 300 chars, additional context 500, custom
pills 120 chars / 50 items, `excludeTitles` capped at 100.

**Secrets** — all LLM provider keys and the Google Maps key live in Secret
Manager and never reach the client. Hero images arrive as embedded bytes, so no
Maps key or URL is ever in a response.

**Cost caps** — `maxInstances` on the generation functions, plus a Cloud Billing
budget with alerts.

**Firestore rules** — default-deny. The app never reads Firestore directly; all
access is server-side via the Admin SDK.

## Related

- Console setup still outstanding → `docs/milestones.md` (one list, not two)
- Backend contract, rate-limit design, error codes →
  `docs/architecture/03-api-contracts.md`
