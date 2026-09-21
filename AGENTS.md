# Horizon repository guidance

Horizon is a monorepo for an iPhone app, its Firebase backend, and its public
website/admin console. Keep this file short: it is loaded for every task.

## Before changing a subsystem

- Read the nearest scoped instructions: `ios/AGENTS.md`,
  `functions/AGENTS.md`, or `hosting/AGENTS.md`.
- Read only the reference document the task needs; do not preload all of
  `docs/` or `ios/docs/`.
- Treat code and configuration as the implementation source of truth. Update
  the relevant durable document whenever behavior or an invariant changes.

## Repository map

- `ios/` — SwiftUI iPhone app, SwiftData/CloudKit persistence, Firebase client.
- `functions/` — Firebase Cloud Functions gen 2, TypeScript, Node 22.
- `hosting/` — React/Vite public site, privacy page, and admin console.
- `firestore/` — client security rules and composite indexes.
- `extensions/` — Firebase extension configuration.
- `docs/` — cross-system backend, API, operations, and roadmap references.

## Documentation router

- Client/backend wire shapes: `docs/api/api-contracts.md`
- Backend flow and invariants: `docs/backend/architecture.md`
- Generation telemetry and privacy: `docs/backend/observability.md`
- Admin access and behavior: `docs/operations/admin-dashboard.md`
- Secrets and deployment binding: `docs/operations/secrets.md`
- Release and console state to verify: `docs/operations/release-checklist.md`
- iOS product, architecture, and design: `ios/docs/`
- Deferred work: `docs/roadmap/` and `ios/docs/backlog.md`

## Working agreements

- `functions/` uses Yarn 1 and `yarn.lock`; `hosting/` uses npm and
  `package-lock.json`. Do not create the other lockfile in either subtree.
- Node 22 is the backend, hosting CI, and Firebase runtime baseline.
- Never edit generated output: `functions/lib/`, `hosting/dist/`,
  `*.tsbuildinfo`, or Xcode user data.
- A wire-contract change must update the TypeScript types/handler, Swift
  request or response structs and call sites, and the canonical API contract in
  the same change.
- Do not add secrets to the repository. Firebase web configuration identifies
  the public project; authorization still belongs in Auth, App Check, and
  Firestore rules.
- Pushes to `main` can deploy production functions or hosting. Do not deploy,
  push, rotate secrets, change console state, or delete branches unless the
  user explicitly asks.

## Verification

Run the smallest relevant checks, then expand for cross-system changes:

- Backend: tests and TypeScript build from `functions/`.
- Hosting: tests, typecheck, and production build from `hosting/`.
- iOS: build the `horizon` scheme when full Xcode is available; there is
  currently no iOS test target or iOS CI workflow.
- Documentation: validate relative links and search for stale paths or renamed
  concepts.
- Finish with `git diff --check` and inspect `git status --short`; never discard
  unrelated user changes.
