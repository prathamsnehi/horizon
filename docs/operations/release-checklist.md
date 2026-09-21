# Release and operations checklist

This file records work that depends on Firebase, Google Cloud, CloudKit, GitHub,
or App Store state. Repository inspection cannot prove those systems' current
state, so every item is marked **VERIFY** until a human checks it. Remove items
when completed; do not turn this back into a dated handoff log.

## Firebase and Google Cloud

- [ ] **VERIFY:** The latest Functions and Hosting workflows on `main` are green.
- [ ] **VERIFY:** `RATE_LIMIT_EXEMPT_UIDS` exists in Secret Manager before the
  next non-interactive Functions deployment, even if its value is empty.
- [ ] **VERIFY:** Anonymous Firebase Auth is enabled for the iOS app and the
  retired Apple provider is disabled if it is no longer used.
- [ ] **VERIFY:** App Check uses App Attest in Release builds and enforcement is
  enabled for both callable functions; simulator/debug tokens are registered
  only for development.
- [ ] **VERIFY:** The Cloud Tasks API and the queue used by
  `pregenerateCuratedBatch` are enabled and healthy.
- [ ] **VERIFY:** Firestore rules and indexes from `firestore/` are deployed.
- [ ] **VERIFY:** The browser Firebase API key is restricted to the production
  web origins plus `http://localhost:5174/*`, and only the Firebase APIs needed
  by Auth, token refresh, Firestore, and Installations are allowed.
- [ ] **VERIFY:** `PLACES_API_KEY` is a separate server-side key restricted to
  the Places API and is not the hosting browser key.
- [ ] **VERIFY:** At least one intended operator has an `admins/{uid}` document
  and can exercise signed-out, unauthorized, and authorized admin states.

## Data deletion and privacy

- [ ] Close the known Auth-deletion gap: the current in-app “Delete all data”
  intentionally preserves the anonymous Firebase user and therefore does not
  trigger the delete-user-data extension. If an Auth-deletion path is added, or
  accounts are deleted administratively, the extension currently removes
  `user_rate_limits/{UID}` but not `pregen_cache/{UID}`. Decide the intended
  policy, add the cache path if appropriate, and verify both server documents.
- [ ] **VERIFY:** `/privacy` accurately explains anonymous Auth, on-device and
  private-iCloud content, profile data sent to model providers, Google Places,
  the pre-generation cache, rate-limit stamps, and retained de-identified
  generation samples.
- [ ] **VERIFY:** App Store privacy labels and the privacy-policy URL match that
  policy and current behavior.

## iOS and CloudKit

- [ ] **VERIFY:** Exercise every SwiftData field in the CloudKit Development
  schema on a real device, including completion photos, journal text, a
  described quest, and location data.
- [ ] **VERIFY:** Deploy the complete CloudKit schema to Production before the
  release that depends on it; production schema changes are append-only.
- [ ] **VERIFY:** Run real-device Release QA for both color schemes, offline
  behavior, denied camera/photo permissions, rapid swipes, one-card decks,
  spent generation windows, many completed quests, and account reset.
- [ ] **VERIFY:** Complete VoiceOver and Dynamic Type passes.
- [ ] **VERIFY:** Set the intended marketing version/build number and finish App
  Store screenshots and age rating.

## Failure-path QA

- [ ] **VERIFY:** A fresh install completes onboarding, receives a curated set,
  receives a later pre-generated set, creates a described quest, and renders
  place photos.
- [ ] **VERIFY:** Missing App Check, malformed profiles, oversized prompts, and
  blocked prompts fail without model/Places spend or a durable daily stamp.
- [ ] **VERIFY:** Concurrent generation produces the short pending cooldown and
  a successful delivery produces the rolling 24-hour cooldown shown by iOS.
- [ ] **VERIFY:** Disabling the primary model provider exercises fallback and a
  Places failure still produces usable generic quests.

## Repository housekeeping

- [ ] **VERIFY:** The stale local and remote `test` branches can be deleted; do
  not delete them as part of documentation maintenance.
- [ ] **VERIFY:** Production deploy permissions for the GitHub service account
  remain sufficient and no local credential file is required by CI.

Related references: [`secrets.md`](secrets.md),
[`admin-dashboard.md`](admin-dashboard.md),
[`../backend/architecture.md`](../backend/architecture.md), and
[`../../ios/docs/backlog.md`](../../ios/docs/backlog.md).
