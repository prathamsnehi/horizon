# Horizon for iOS

The SwiftUI client for Horizon, an iPhone app that turns a user's interests and
comfort-zone edges into real-world quests. Generated quests can be chosen from a
swipe deck, completed with photos and a journal entry, and revisited in a
logbook.

The rest of the product lives in this repository: `../functions/` contains the
Firebase backend and `../hosting/` contains the public site and admin dashboard.

## Requirements

- Full Xcode with an iOS 18.6-or-newer SDK/runtime
- An iPhone simulator or signing access for a physical device
- Network access the first time Swift Package Manager resolves
  `firebase-ios-sdk`

The app target is iPhone-only with a minimum deployment target of iOS 18.6.
Firebase configuration and CloudKit entitlements are committed for the Horizon
project; backend secrets are not client configuration and must never be added
here.

## Run

Open `horizon.xcodeproj`, select the `horizon` scheme, and run on an iPhone
simulator or device. Existing quests, completion, and the logbook work offline;
generating quests calls the deployed Firebase project configured by
`horizon/GoogleService-Info.plist`.

Debug builds use Firebase's App Check debug provider. When App Check enforcement
is enabled, register the token printed by a new simulator or development install
in the Firebase console before testing generation. Release builds use App
Attest and should be exercised on real hardware.

For a command-line compile check:

```bash
xcodebuild \
  -project ios/horizon.xcodeproj \
  -scheme horizon \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Run this from the repository root. There is currently no iOS test target or iOS
CI workflow, so meaningful changes also need focused simulator or device QA.

## Documentation

- `AGENTS.md` — task routing, conventions, invariants, and verification guidance
- `docs/product.md` — product intent and current user flow
- `docs/architecture.md` — app structure, persistence, lifecycle, and navigation
- `docs/design.md` — durable visual and interaction system
- `docs/backlog.md` — explicitly deferred work and release checks
- `../docs/api/api-contracts.md` — canonical client/backend wire contract

For implemented behavior, Swift source is authoritative. Update a durable doc
only when its invariant or contract changes; avoid documenting view internals
that are already clear from the code.
