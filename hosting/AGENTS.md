# Hosting agent guide

This directory contains the React 19 + Vite 6 + Tailwind CSS 4 app served at
`usehorizon.app`: the public showcase at `/`, the privacy policy at `/privacy`,
and the internal observability console under `/admin`.

## Work locally

Use Node 22 and npm. `package-lock.json` is the dependency source of truth.

```bash
npm ci
npm run dev       # http://localhost:5174
npm test
npm run typecheck
npm run build
```

`dist/` is generated and ignored. There is no lint script or browser-test suite;
do not claim those checks ran.

## Code boundaries

- `src/routes/Home.tsx`, `src/routes/Privacy.tsx`, and `src/components/site/`
  are the public site. Shared external URLs belong in `src/lib/links.ts`.
- `src/routes/admin/` is the lazy-loaded admin console. Its Firestore readers
  and aggregation logic live in `src/lib/samples.ts`, `siteMetrics.ts`, and
  `stats.ts`.
- Firebase Hosting configuration is in `../firebase.json`; admin authorization
  and query indexes are in `../firestore/`.
- Admin setup and operational details live in
  `../docs/operations/admin-dashboard.md`.

## Invariants

- Keep Firebase out of every module reachable from the public routes. `/admin`
  is lazy-loaded in `src/App.tsx`, and `vite.config.ts` puts Firebase in its own
  chunk so public visitors do not download it. After dependency or import-graph
  changes, confirm the build still emits separate admin and Firebase chunks.
- The Firebase web config in `src/lib/firebase.ts` is intentionally public.
  Authentication plus Firestore rules are the security boundary; do not move
  the config to a secret or treat the React authorization gate as sufficient.
- `src/types.ts` mirrors documents written by backend observability code. Change
  it alongside `../functions/src/observability/tracer.ts` and related backend
  types; schema drift otherwise produces misleading or empty dashboards.
- Marketing analytics remain aggregate and cookieless. `src/lib/analytics.ts`
  sends identifier-free events to the same-origin `/api/track` rewrite backed
  by `trackEvent`; never add a user, device, or persistent visitor identifier.
- Preserve the social-card metadata near the top of `index.html`. Its position
  is intentional because some crawlers read only an initial byte range.
- Local `/admin` connects to the real Firebase project and can display live
  production data. Use read-only test behavior unless the task explicitly
  includes an operational change.

## Verification

Run `npm test`, `npm run typecheck`, and `npm run build` for code changes. Also
check the affected routes manually: responsive and reduced-motion behavior for
the public site; poster, buffering, and scroll scrubbing for showcase-media
changes; and signed-out, unauthorized, authorized, loading, and error states
for admin changes.

Pushes to `main` that touch `hosting/**` or `firebase.json` deploy Firebase
Hosting; pull requests from this repository receive preview deployments. Do not
deploy manually unless the task explicitly asks for it.
