# Admin dashboard operations

The internal console at `https://usehorizon.app/admin` reads Horizon's
de-identified operational data directly from Firestore through the web client SDK.
There is no Admin SDK or service-account credential in the browser.

## Routes and data

- `/admin` shows generation health for a 24-hour, 48-hour, or 7-day window:
  outcomes, p50/p95 latency, pipeline-stage latency, Maps resolution, cache and
  generic-fallback rates, provider failover, model usage, and recent failures.
- `/admin/logs` pages through `generation_samples` and filters by generation
  type or outcome.
- `/admin/logs/:id` renders one sample as a span waterfall with stage payloads
  and the provider attempt chain.
- The dashboard also reports the last 30 days of marketing traffic from
  `site_metrics`: page views, visits, TestFlight clicks, conversion, referrers,
  and device category.

`generation_samples` is capped at the 300 most recent documents in the selected
dashboard window. The UI reports when the cap is reached. Firestore's web SDK
cannot project only summary fields, so this bounds document reads and payload
size. If volume outgrows it, use the compact summary collection described in
[the backlog](../roadmap/backend.md) rather than silently raising the cap.

## Access model

Google sign-in identifies the operator, but Firestore rules authorize access.
An account is an admin only when `admins/{uid}` exists. The React gate controls
what is rendered; the rules in
[`firestore/firestore.rules`](../../firestore/firestore.rules) are the security
boundary for `generation_samples` and `site_metrics`.

To grant access:

1. Enable Google in Firebase Console → Authentication → Sign-in method.
2. Sign in at `/admin`. An unauthorized account sees its uid with a copy button.
3. Create `admins/{uid}` in Firestore Console; document contents are irrelevant.
4. Deploy rules and indexes if the checked-in versions are not live:

   ```bash
   npx firebase-tools@14 deploy \
     --only firestore:rules,firestore:indexes \
     --project horizon-sidequests
   ```

Delete `admins/{uid}` to revoke access. Grants and revocations take effect
without an application deploy. Never make `generation_samples`, `site_metrics`,
or the admin allowlist publicly readable to simplify the UI.

The log filters require the composite indexes in
[`firestore/firestore.indexes.json`](../../firestore/firestore.indexes.json).
New indexes can take a few minutes to build; until ready, Firestore returns an
error that identifies the missing index.

## Local development

```bash
cd hosting
npm ci
npm run dev       # http://localhost:5174/admin
```

Localhost uses the committed Firebase web configuration and therefore signs in
against the real `horizon-sidequests` project. Authorized sessions display live
production records. Do not create, alter, or delete production data while doing
UI work unless the task explicitly requires an operational change.

## Browser API key restrictions

The Firebase web key in `hosting/src/lib/firebase.ts` is safe to ship: it
identifies the project but does not grant Firestore access. It still must be
restricted in Google Cloud Console so it cannot call unrelated enabled APIs.

For the browser key, configure website restrictions for:

```text
https://usehorizon.app/*
https://horizon-sidequests.web.app/*
https://horizon-sidequests.firebaseapp.com/*
http://localhost:5174/*
```

Add any replacement custom domain before switching traffic. Restrict the key to
the APIs required by the Firebase web app: Identity Toolkit, Token Service,
Cloud Firestore, and Firebase Installations. Do not enable Places or Maps APIs
on this key. The backend `PLACES_API_KEY` is a separate Secret Manager value,
restricted to Places API and never sent to a client.

After changing restrictions, verify sign-out, Google sign-in, admin allowlist
lookup, dashboard reads, and log filters from both the production domain and
localhost. A restriction error can otherwise resemble an authorization bug.

## Operational verification

Before deploying a dashboard change:

```bash
cd hosting
npm test
npm run typecheck
npm run build
```

Confirm the build retains separate admin and Firebase chunks. Then exercise the
signed-out, unauthorized, and authorized states; load each admin route; filter
logs by type and outcome; and open a trace detail. Hosting deploys automatically
on pushes to `main` that touch `hosting/**` or `firebase.json`; pull requests
from this repository receive Firebase preview channels.
