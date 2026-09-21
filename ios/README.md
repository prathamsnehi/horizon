# Horizon

An iPhone app that generates AI-powered real-world "quests" — small challenges
built around what you avoid — then lets you document them with photos and a
journal entry.

You name your comfort-zone edges during onboarding, pull a fresh hand of quests
each day, swipe to commit to one, and log it when it's done.

## Stack

- **SwiftUI**, iOS 18.6+, iPhone only
- **SwiftData** for persistence, mirrored to the user's private iCloud database
  via CloudKit
- **Firebase** — anonymous Auth (no sign-in screen), Cloud Functions for
  generation, App Check
- **MapKit** for the city picker and quest locations

No third-party dependencies beyond `firebase-ios-sdk`.

## Running it

Open `horizon.xcodeproj` in Xcode and run — SPM resolves Firebase on first
build, and `GoogleService-Info.plist` is committed, so there's no setup step.

The generation backend lives in a separate repo. Without it the app still runs:
onboarding, the deck, completion, and the logbook all work offline against
whatever quests are already stored.

## Docs

`CLAUDE.md` is the orientation file and routes to the rest. Briefly:

| | |
| --- | --- |
| `docs/concept.md` | what the app is and the full user flow |
| `docs/design.md` | design language, components, palette |
| `docs/architecture/` | models, backend contract, screens, key decisions |
| `docs/milestones.md` | what's built and what's left for v1 |
| `docs/future-features.md` | not built — don't build unless asked |

Anything already built, the code is the reference.
