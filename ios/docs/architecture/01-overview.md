# Architecture Overview

## Pattern

MVVM with a Service layer. Data flows down, actions flow up: Views observe ViewModels, ViewModels call Services, Services talk to SwiftData and Cloud Functions.

- **Models** — the SwiftData models (`Quest`, `UserProfile`) plus the vocabulary and rules around them (`ProfileVocabulary` — every preset pill and the `ComfortZoneEdge` catalogue — `ProfileDraft`, `GenerationLimit`, `ValidationLimits`)
- **Views** — SwiftUI, as thin as possible
- **ViewModels** — `@Observable` classes owning a screen's state and logic
- **Services** — side effects, stateless or nearly so: `CloudFunctionService`, `AnonymousSession`, `CitySearch`, `FirstGenerationLauncher`, `LocalDataReset`, `PhotoCache`

**ViewModels are for screens that need one.** Where SwiftData's `@Query` is enough (`QuestScreen`, `LogbookScreen`), there isn't one. Reserve them for complex state or side effects — onboarding, generation, the deck, the completion form.

## Key Architectural Decisions

1. **SwiftData for all local persistence** — quests, user profile, journal entries, completion state. No Core Data, no SQLite, no UserDefaults (except for simple flags like "has completed onboarding").

2. **Photos stored on the models as `Data`** — journal photos are JPEG bytes in `Quest.journalPhotoData`, hero photos in `Quest.locationPhotoData`, both `@Attribute(.externalStorage)` so SwiftData keeps the blobs out of the SQLite rows while CloudKit mirroring can still sync them. No file layer, no filename bookkeeping.

3. **Firebase Cloud Functions as a thin API layer** — the app doesn't know or care which AI model powers generation (the backend routes across multiple LLM providers). It sends structured requests and receives structured responses. The Cloud Function is the boundary. The backend uses **Cloud Firestore** to cache pre-generated quest sets per user, so most personalized requests return instantly. Pre-generation is entirely a backend concern — the app just calls the endpoint and handles both instant and delayed responses with a "curating" loading state.

   **Identity is the Firebase Auth uid, from an anonymous session.** There is no sign-in screen: `AnonymousSession` establishes the session lazily on the first Cloud Function call. Calls go through the Firebase Callable API, so the Auth ID token and App Check token ride along automatically and the client never sends an identifier in the payload. That uid keys both the server-side daily limits and the pre-gen cache, and is scoped to the install. Why a session rather than App Check alone, or a device ID → `developer/security-hardening-checklist.md`.

4. **Local notifications for reminders** (v2) — no Firebase Cloud Messaging. Spec in `future-features.md`.

5. **Offline-first for existing data** — everything already downloaded (quests, photos, journal entries) is available offline via SwiftData. Generation features gracefully show "you're offline" states.

6. **No Combine** — use Swift's async/await and structured concurrency for all asynchronous work.

7. **Hero images arrive embedded, no image networking** — the place photo comes base64-embedded in the generation response, is decoded once into `Quest.locationPhotoData` (externalStorage), and renders from those bytes everywhere. No image URLs, no cache library, and the Maps key never reaches the client. Rendering goes through `PhotoCache`, since a SwiftUI body re-runs constantly — an Explore card's body is rebuilt on every frame of a drag, and re-decoding three hero photos at 60fps is not free.

8. **One active quest at a time, deck refreshed on request** — the user holds a small set of `.available` cards presented as a Tinder-style looping swipe deck (bookended by a base card carrying today's actions), and commits to a single `.active` quest by swiping right (with a quick confirmation). Swiping left means "not now" — it never removes a card; the deck loops. Cards are added on demand through two once-per-day actions; each lane replaces its own unaccepted cards (Rules 1 & 2 — full lifecycle in `02-data-models.md`). This keeps the deck small, the Quest tab focused on one quest, and backend calls naturally limited. No reroll/dice feature — swiping the deck is the discovery mechanism.

9. **CloudKit via SwiftData mirroring** — `cloudKitDatabase: .automatic` on the model configuration syncs the entire store (profile and all quests, deck included) to the user's private iCloud database in the background; SwiftData/CloudKit own the schedule and merging. The lean-code trade was deliberate: no explicit restore moment (onboarding always runs the questionnaire; synced-in data simply appears), and app-level invariants that mirroring can't know are re-enforced locally (profile-singleton dedupe on foreground, keeping the newest `updatedAt`). Requires every model property defaulted/optional and photos stored as model `Data` rather than files.

## Where things live

The folder layout under `horizon/` is the source of truth (the Xcode project is filesystem-synchronized): `App/` (entry point, `MainTabView`), `Core/Models`, `Core/ViewModels`, `Core/Services`, `Views/<Feature>/` with feature-specific pieces in `Views/<Feature>/Components/` and app-wide reusables in `Views/Components/`. Screen specs and navigation patterns: `04-screens-and-navigation.md`.
