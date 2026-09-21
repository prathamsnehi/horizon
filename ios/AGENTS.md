# iOS agent guide

This file applies to everything under `ios/`. Follow repository-level guidance
first, then use this file for iOS-specific work.

## Read only what the task needs

- Product behavior or deck semantics: `docs/product.md`
- Persistence, lifecycle, navigation, or service boundaries:
  `docs/architecture.md`
- UI, interaction, color, typography, or motion: `docs/design.md`
- Planned or explicitly deferred work: `docs/backlog.md`
- Client/backend payloads and errors: `../docs/api/api-contracts.md`
- Backend implementation: `../functions/src/`

Do not create a second API contract under `ios/`. When a wire shape changes,
update the backend types, the canonical root contract, and
`horizon/Core/Services/CloudFunctionService.swift` together.

## Project facts

- Project, scheme, and app target: `horizon`
- SwiftUI; iPhone only; minimum deployment target iOS 18.6
- Swift 5 language mode with approachable concurrency and default MainActor
  isolation enabled in the Xcode project
- SwiftData mirrored to the user's private CloudKit database
- Firebase Auth, App Check, and callable Cloud Functions through
  `firebase-ios-sdk` 12.15+
- `horizon/` is a filesystem-synchronized Xcode group. New Swift files beneath
  it are discovered automatically; do not add manual PBX file entries for them.

Source layout:

- `horizon/App/` — app entry point and cross-tab navigation
- `horizon/Core/Models/` — SwiftData models, profile vocabulary, and validation
- `horizon/Core/ViewModels/` — screen state and orchestration
- `horizon/Core/Services/` — Firebase, city search, image caching, and resets
- `horizon/Views/<Feature>/` — screens and feature-local components
- `horizon/Views/Components/` — reusable app-wide UI

## Load-bearing invariants

- SwiftData models mirrored through CloudKit must keep every stored property
  optional or defaulted and must not use unique constraints. `UserProfile` is a
  singleton by convention and is deduplicated on foreground.
- Authentication is anonymous and lazy. `request.auth.uid` is the server-side
  identity; never add a client identifier to a callable payload.
- Place photos arrive as base64, are decoded once, and persist as external
  storage `Data`. Journal photos also live on `Quest`. Do not introduce image
  URLs, a file layer, or a client-visible Maps key.
- There is at most one `.active` quest. A left swipe is nondestructive. A new
  curated set replaces only available personalized cards; a described quest
  replaces only the available described card. Active and completed quests are
  untouched. The onboarding generation is the one append-only exception.
- Client generation timestamps are UX gates only. The backend's per-uid rolling
  window is authoritative, and `retryAt` reconciles local state.
- Profile string collections accept presets and custom values. Keep
  `LocationPreference.anywhere` mutually exclusive with specific locations.
- Prefer async/await and structured concurrency; do not add Combine for new
  work. Screen models that perform UI/state work remain MainActor-isolated.
- Use the named colors in `Assets.xcassets`, support light and dark mode, and
  reuse `Views/Components` before creating a feature-local duplicate.

## Development and verification

Open `horizon.xcodeproj` with full Xcode. The committed
`GoogleService-Info.plist` selects the deployed Firebase project. Debug builds
use the App Check debug provider; with enforcement enabled, register the debug
token printed by each new simulator or development install. Release App Check
uses App Attest and requires real-device QA.

From the repository root, compile with:

```bash
xcodebuild \
  -project ios/horizon.xcodeproj \
  -scheme horizon \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

There is currently no iOS test target, shared iOS CI job, SwiftLint, or
SwiftFormat configuration. Report the build and the focused manual scenarios
you ran; if full Xcode or a suitable runtime is unavailable, report that clearly
instead of implying verification.

For UI changes, exercise both color schemes and relevant accessibility sizes.
For persistence changes, test an existing store and CloudKit-compatible model
rules. For generation changes, cover offline, malformed/error, rate-limited,
empty/partial response, and success paths as applicable.
