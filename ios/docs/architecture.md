# iOS architecture

Horizon uses SwiftUI with an MVVM-style service boundary. Views own presentation,
screen models coordinate stateful workflows, services perform side effects, and
SwiftData models are the local source of truth. Screens that need only `@Query`
do not receive a view model merely for consistency.

## Layout

```text
horizon/
  App/                 app entry point and tab coordination
  Core/
    Models/            SwiftData models, enums, validation, profile vocabulary
    ViewModels/        onboarding, Explore, Settings, and completion workflows
    Services/          Firebase, MapKit search, reset, and image caching
  Views/
    Components/        app-wide reusable UI
    <Feature>/          screens and feature-local components
```

The `horizon/` directory is a filesystem-synchronized Xcode group, so source
files added below it are included without hand-editing `project.pbxproj`.

## Persistence and identity

`horizonApp` creates one SwiftData `ModelContainer` for `UserProfile` and
`Quest`, using `cloudKitDatabase: .automatic`. CloudKit owns background sync and
merging; the app has no custom sync layer or explicit restore step.

CloudKit-backed SwiftData imposes two important model rules: every persisted
property must be optional or have an inline default, and models cannot rely on
unique constraints. `UserProfile` is a singleton by convention, so the app
deduplicates profiles on foreground and retains the newest `updatedAt` value.

The synchronous launch gate is `@AppStorage("hasCompletedOnboarding")`, not a
model field. A reinstall therefore runs onboarding while CloudKit may restore
the previous profile and logbook in the background.

Firebase authentication is anonymous and lazy. `AnonymousSession` serializes
concurrent sign-in attempts and establishes the session before a callable
request. The verified `request.auth.uid` identifies the install to the backend;
it is never included in a payload. `LocalDataReset` intentionally keeps this
anonymous account while removing local/profile data.

## Models and lifecycle

`UserProfile` stores questionnaire values, the selected city and coordinates,
and client-side timestamps for the two generation lanes. Interests, vibes, and
comfort-zone edges are open `[String]` collections containing presets plus user
values. Budget, transport, and location preferences use enums;
`.anywhere` is mutually exclusive with specific location preferences.

`Quest` owns generated content, its origin, optional place information, state,
and completion data. Relevant state is deliberately small:

```text
available --commit--> active --complete--> completed
                    ^
active --swap-------+  (old active returns to available)
```

There is no skipped state. One quest may be active at a time. Model mutation
methods update `updatedAt`, which supplies an app-level merge timestamp that
CloudKit does not expose.

Place photos are decoded from response base64 once and stored in
`locationPhotoData`; journal images are JPEG bytes in `journalPhotoData`. Both
use `@Attribute(.externalStorage)`, remain available offline, and sync with their
quest. `PhotoCache` memoizes `UIImage` decoding for rendering only. There is no
file-path layer, remote image URL, or client Maps API key.

## Generation boundary

`CloudFunctionService` is the only callable boundary. It builds the profile
payload, establishes the anonymous session, applies a 90-second client timeout,
decodes responses, and maps transport/Firebase errors into app errors.

The canonical request, response, and error contract is
`../../docs/api/api-contracts.md`; backend types live in
`../../functions/src/types.ts`. Do not copy that contract back into this
directory. A contract change must update the server, canonical contract, and
client wire structs together.

`ExploreScreenModel` owns normal generation:

- Curated success deletes available `.personalized` quests, inserts the returned
  set, and stamps the curated client gate.
- Described success deletes available `.described` quests, inserts one new card
  with its prompt, and stamps the described client gate.
- A backend `resource-exhausted` error supplies `retryAt`; the model reconciles
  its local timestamp to that server value.
- Other failures preserve existing quests and surface an appropriate state.

`FirstGenerationLauncher` is fire-and-forget. It appends its successful response
instead of applying the normal curated replacement rule, and otherwise leaves
onboarding free to finish. `FirstGenerationStatus` lets Explore show the same
in-flight progress when the user arrives before the call completes.

## Navigation and screen ownership

`horizonApp` chooses onboarding or `MainTabView`. The main view owns the selected
tab and the Logbook navigation path:

```text
MainTabView
  Quest      active quest; completion uses a full-screen cover
  Explore    base card + looping deck; describe/settings use sheets
  Logbook    completed timeline and typed Quest detail path
```

Committing switches to Quest. Swapping switches to Explore without altering the
active quest. Completing switches to Logbook and pushes the new entry.

Onboarding's generic `SwipeDeck` and Explore's stateful `DeckStack` are
deliberately separate. Share physics or small components when useful, but do not
force the two workflows into one state machine.

## Platform constraints

- iPhone only, minimum iOS 18.6; the project enables default MainActor isolation.
- Use async/await and structured concurrency rather than Combine.
- Debug App Check uses the debug provider; release uses App Attest.
- Existing content is offline-first. Generation is the only current remote user
  workflow.
- Local reminders and external sharing are deferred. No FCM or notification
  service is part of the current architecture.
