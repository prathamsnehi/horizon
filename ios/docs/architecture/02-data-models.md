# Data Models

All persistent models use SwiftData, mirrored to iCloud (see [What syncs to iCloud](#what-syncs-to-icloud)). Photos are JPEG `Data` on the models themselves (`@Attribute(.externalStorage)`) — no file layer, so the bytes sync with their quest.

## UserProfile

Stores the user's onboarding results. Singleton — only one per app.

```swift
UserProfile
├── updatedAt: Date                            — the tiebreak when CloudKit merges in a second profile
│
│  // Onboarding results (collected via Guided UI)
├── interests: [String]                       — what they're into *and* what they'd like to get into; both tenses belong here (the onboarding/Settings field says so in a hint under the label)
├── comfortZoneEdges: [String]                — what they avoid; the app's premise as data. Picked in onboarding's edge deck (preset cards + a custom one)
├── vibes: [String]                           — how they want to experience quests; free-form (preset pills + user customs). Sent on the wire as `vibe` (singular) — the backend's field name
├── experimentationLevel: Int                 — the how-far dial (1-5): how far past the edge to push
├── budget: [BudgetLevel]                     — .free, .cheap, .moderate, .splurge
├── transportation: [TransportationMode]      - .walking, .publicTransport, .car, .bike, .rideshare
├── locationPreferences: [LocationPreference] — preferred environments (e.g., Nature, Indoors)
├── additionalContext: String?                — optional nuance text
│
│  // Location
├── city: String                       — user's base city (e.g., "San Francisco")
├── cityLatitude: Double?              — latitude of the city center (sent to backend for distance/transport math)
├── cityLongitude: Double?             — longitude of the city center (sent to backend for distance/transport math)
│
│  // Daily generation limits (each action usable once per rolling 24h; client-side UX gating only)
├── lastCuratedGenerationDate: Date?    — when the user last generated a personalized set
└── lastDescribedGenerationDate: Date?  — when the user last described a quest
```

> **Onboarding completion is not on the model.** It's a plain `@AppStorage("hasCompletedOnboarding")` flag read by `horizonApp`'s `WindowGroup` — UserDefaults is readable synchronously at launch, so the gate never waits on a SwiftData query. (This is the one sanctioned UserDefaults use — see `01-overview.md` decision #1.)

**Daily limit logic:** each action recharges 24h after its stored date (`GenerationLimit`); `nil` means available. Generating a personalized set stamps `lastCuratedGenerationDate`; describing stamps `lastDescribedGenerationDate`. **These are UX gating only** — the backend enforces the real 24h rolling window on the auth uid. When the server returns `resource-exhausted` with a `retryAt`, the client reconciles by back-dating its stamp to `retryAt − 24h`, so the two never disagree.

## Quest

The core model. Represents a single quest regardless of its state.

```swift
Quest
├── id: UUID
├── createdAt: Date
├── updatedAt: Date                    — bumped by every mutating method; mirroring doesn't expose CloudKit's own modification stamp
│
│  // Content (from Cloud Function response)
├── title: String
├── questDescription: String
├── difficulty: DifficultyRating       — .easy, .moderate, .hard, .extreme
├── estimatedActivityMinutes: Int      — estimated activity duration in minutes
├── categories: [String]               — classification labels (e.g., adventure, creativity)
├── pushesComfortZoneEdges: [String]   — which of the user's edges this quest targets, priority order (primary first); empty on generic quests. The receipt for what onboarding asked
│
│  // Origin (client-side; not sent by backend)
├── origin: QuestOrigin            — .personalized (from a generated set) or .described (from user's prompt)
├── userPrompt: String?                — the text the user typed, for .described quests only (nil otherwise)
│
│  // Location (optional — nil if quest is not location-based)
├── locationInformation: LocationInformation?
├── locationPhotoData: Data?           — the place photo, decoded once from the response's embedded base64 (@Attribute(.externalStorage)); nil → bundled placeholder
│
│  // State
├── status: QuestStatus                — .available, .active, .completed
├── acceptedAt: Date?                  — when it became .active; cleared on swap
├── completedAt: Date?
│
│  // Completion data
├── journalEntry: String?              — user's reflection text
└── journalPhotoData: [Data]           — journal photos as JPEG bytes (externalStorage)
```

### LocationInformation

Codable struct grouping all location data. Present only on location-based quests. Populated entirely from the Cloud Function response.

```swift
LocationInformation
├── name: String                       — name of the place (e.g., "Dolores Park")
├── address: String                    — full address string
├── locationDescription: String        — editorial summary from Google Maps (named to avoid clashing with NSObject's `description`)
├── latitude: Double                   — for MapKit display
├── longitude: Double                  — for MapKit display
├── photoImageBase64: String?          — wire-only: embedded place-photo bytes (no URL/key); decoded into Quest.locationPhotoData on receipt, then nilled — never persisted
├── photoContentType: String?          — wire-only companion (e.g. "image/jpeg"); nilled with the base64
├── googleMapsURL: String              — URL to open the place in Google Maps
├── distanceMiles: Double?             — from backend (Haversine); present only when city coords were supplied
└── transportationOptions: [TransportationOption] — from backend (heuristic per-mode); 0-minute placeholders when city coords absent
```

### TransportationOption

```swift
TransportationOption
├── mode: TransportationMode           — .walking, .car, .publicTransport, etc.
├── estimatedTravelMinutes: Int        — estimated travel time in minutes
└── isRecommended: Bool                — true if the backend recommends this mode
```

### BudgetLevel (enum)

```swift
.free
.cheap
.moderate
.splurge
```

> **No QuestVibe enum.** `vibe` is free-form `[String]` — preset pills plus an "add your own" input, the same pattern as `interests` and `comfortZoneEdges`. The preset lists live in `Core/Models/ProfileVocabulary.swift`, shared by onboarding and Settings.

### TransportationMode (enum)

```swift
.walking
.publicTransport
.car
.bike
.rideshare
```

### LocationPreference (enum)

```swift
.downtown
.neighborhood
.nature
.indoors
.waterfront
.anywhere
```

> **`.anywhere` is mutually exclusive.** Selecting it clears every other preference, and selecting any specific preference removes it (enforced in `OnboardingFlowScreenModel.toggleLocationPreference`). An "all of the above including anywhere" selection biases the LLM toward the specific options and drowns out "anywhere".

### QuestOrigin (enum)

```swift
.personalized — came from a generated personalized set
.described    — built from a free-text prompt the user wrote
```

Origin drives both UI (a subtle "your idea" badge on described quests) and the deck-clearing logic (see Daily Deck Lifecycle — generating a personalized set only clears `.personalized` cards).

### QuestStatus (enum)

```swift
.available    — sitting in the deck, not yet acted on
.active       — user swiped right + confirmed; this is their current quest (only one at a time)
.completed    — done, has photos/journal, moved to the logbook
```

> **There is no skipped state.** Left-swiping is "not now," not a skip — it never removes a card or changes its status, and the deck loops.

### DifficultyRating (enum)

```swift
.easy      // "Within"
.moderate  // "A step out"
.hard      // "Well beyond"
.extreme   // "Far beyond"
```

The raw values are frozen — they're the wire contract with the backend. The UI never shows them: `displayName` (in `QuestFormatting`) renders the comfort-zone phrasing above, under the stat label **COMFORT ZONE**.

## Daily Deck Lifecycle

There is no fixed "batch." The user's deck is simply every `.available` card they currently hold, presented as a looping swipe deck bookended by the base card. Cards are added on demand through two daily actions and persist until accepted or replaced.

```swift
Two ways to add cards (each usable once per rolling 24h; both offered
on the base card at the deck's start/end):
│
├── Generate personalized set → adds a set (nominally 3) quests (origin .personalized)
│       └── FIRST clears all .available cards with origin .personalized,
│           then inserts the fresh set  (Rule 1)
│
└── Describe your own → adds 1 quest (origin .described)
        └── FIRST clears any .available card with origin .described
            (the deck holds a single custom slot), then inserts
            the new one  (Rule 2)

Deck order: the described card (if any) leads, then personalized cards
newest-first — a fresh set is always what the user sees on landing.

The deck (all .available cards, looping):
│
├── User swipes left ("not now") → nothing changes (the card comes around next cycle)
├── User swipes right + confirms → quest becomes .active (1 at a time)
│
├── User wants to swap → opens the deck; the active quest stays active
│       until another is committed (which returns it) — backing out is free
│
└── User completes active quest → quest becomes .completed
        │
        └── All other cards stay in the deck (nothing auto-clears on completion)
```

**Key rules:**

- Only **one quest can be `.active`** at any time. Committing to a new one (right swipe + confirm) swaps the current active quest back to `.available`.
- **Cards persist across days.** A card never disappears because a day passed — only accepting it or its own lane's next generation (Rules 1 & 2) changes the deck. Left swipes are **never destructive**.
- **Rule 1 — a personalized generation replaces the previous personalized set.** Generating deletes all `.available` cards whose `origin` is `.personalized` (including a personalized quest that was swapped back out of active), then inserts the new `.personalized` cards. `.completed` quests are historical and never touched.
  - **One exception: the first generation at the end of onboarding appends.** It always fires (no client-side gate — the backend decides) and never deletes, so a reinstalling user whose iCloud cards have synced back keeps them and gets the fresh set on top. Every later generation from Explore follows Rule 1 normally.
- **Rule 2 — describing replaces the previous custom quest.** Describing deletes any `.available` card whose `origin` is `.described` (the deck holds a single custom slot; the Describe sheet shows an inline warning naming the card being replaced), then inserts the new `.described` card. The `.active` quest and `.completed` quests are untouched by any generation.
- **The deck is a chooser, not a wishlist.** To keep a card, commit to it. Because only one quest can be active, the user commits to one at a time.
- **Set size is server-controlled.** The client requests a personalized set without specifying a count; the backend returns a small set (nominally 3). The app renders whatever comes back — partial success (fewer than expected) is expected and handled gracefully.
- Each action is limited to **once per 24h**, for at most ~4 new cards per day. The backend enforces this; the client gates the UI to match.

## How onboarding populates the profile

The flow itself is in `concept.md`; what matters to the models:

- **The edge catalogue lives on `ComfortZoneEdge.presets`** (label, subline, photo asset, photo credit) in `Core/Models/ProfileVocabulary.swift`, and `ProfileVocabulary.comfortZoneEdges` is derived from it, so the deck, the review step, and the Settings pill grid can't drift. `label` is the only part that's persisted or sent.
- **City is picked from MapKit locality suggestions** (`CitySearch` / `CityPickerMap`), never free-typed: `city` stores the disambiguated name ("St. Paul, MN") and `cityLatitude`/`cityLongitude` the exact coordinates captured at selection — no geocode-at-finish guessing (ambiguous names like "St. Paul" used to resolve to the wrong place).
- Draft state lives in `OnboardingFlowScreenModel` for the session only — quitting mid-onboarding restarts the flow (persistence deliberately deferred; the flow takes ~2 minutes). Completing all steps saves the populated `UserProfile`.
- No sign-in step: the first generation establishes an anonymous session on its way out (`AnonymousSession`), so the uid exists by the time the backend sees the call. It sends no `count` — set size is server-controlled — and renders whatever comes back.

## Relationships

One `UserProfile`, many `Quest`s, each carrying its own journal photos inline. The relationship is implicit — no SwiftData relationship is declared, since there's only ever one profile.

## What syncs to iCloud

SwiftData's CloudKit mirroring (`cloudKitDatabase: .automatic` in `horizonApp`) syncs the **entire store** — the profile and all quests (every status, photos included) — to the user's private iCloud database in the background. There is no sync code and no restore moment: after a reinstall, data reappears whenever the sync daemon delivers it. Two consequences the app handles:

- **Profile singleton**: re-onboarding creates a fresh profile and the old one can sync in later — `horizonApp` dedupes on every foreground, keeping the newest `updatedAt`.
- **Mirroring's model rules**: every stored property has an inline default or is optional (both models are annotated accordingly); no unique constraints.

## Notes

- **No separate JournalEntry model** — journal text lives directly on the Quest. One entry per quest, so a separate model adds complexity without benefit.
- **Photos are stored as `Data` on the models** — `journalPhotoData` / `locationPhotoData`, both externalStorage. No files, no paths; the bytes sync to iCloud with the model.
