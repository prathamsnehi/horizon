# Horizon

A personal growth app that generates AI-powered real-world "quests" for users to complete, document with photos and journal entries, and share on social media.

## Docs — read what the task needs

Don't read everything up front; pull in the doc that matches the work:
- **Models, deck rules, quest lifecycle** → `docs/architecture/02-data-models.md`
- **Networking / backend contract** (endpoints, request/response shapes, error codes) → `docs/architecture/03-api-contracts.md`
- **Any UI work** → `docs/design.md` (design language, component rules, palette)
- **Planning a phase / "what's next"** → `docs/milestones.md`
- **Philosophy and the full user flow** → `docs/concept.md`
- **Unbuilt work** (sharing, notifications) → `docs/future-features.md` and `docs/architecture/04-screens-and-navigation.md`
- **Architecture pattern + key decisions** → `docs/architecture/01-overview.md`
- **Why the backend is protected the way it is** → `docs/developer/security-hardening-checklist.md`

Everything built — onboarding, walkthrough, Explore, Quest, Logbook, Settings — the code is the reference.

## Key Rules

- **Never start coding without being told to.** Plan and align first.
- **Always read files before editing.** The user writes code independently between sessions — never assume a file's contents.
- **No Combine.** Use async/await and structured concurrency.
- **iPhone only.** No iPad or Mac layouts.

## Styling

Use custom colors from `Assets.xcassets` — never hardcode hex values:
```swift
Color("AppBackground")      // screen backgrounds
Color("AppPrimary")          // buttons, accents (warm peach-orange, same light+dark)
Color("AppSurface")          // card backgrounds
Color("AppPrimaryText")      // headings, body text
Color("AppSecondaryText")    // metadata, timestamps
```

Both color schemes are supported; all five have light/dark variants except `AppPrimary`.

Design philosophy: **"The Expedition Dossier"** — minimal and calm, but crafted. Depth through light, editorial typography, and motion only when continuously meaningful or as press physics (no one-shot entrance animations). Reusable pieces live in `Views/Components/`; feature-specific ones in `Views/<Feature>/Components/`. Haptics on key interactions. Full language and component specs: `docs/design.md`.

## Architecture at a Glance

- **SwiftData** for persistence (`UserProfile`, `Quest`), mirrored to the user's private iCloud DB via `ModelConfiguration(cloudKitDatabase: .automatic)`. No sync code; onboarding always re-asks the questionnaire on reinstall, and synced-in data appears when it lands (profiles deduped on foreground).
- **Firebase Auth (anonymous)** — no sign-in screen. `AnonymousSession` mints a session silently on the first Cloud Function call. The uid is the only identity: it keys the server-side daily limits and the pre-gen cache, and rides on Callable requests automatically (never in a payload).
- **Firebase Cloud Functions** for AI generation; multi-provider LLM routing and the pre-gen cache (Firestore) are backend concerns.
- **All photos are `Data` on the models** (`@Attribute(.externalStorage)`) — journal photos as JPEG `[Data]`, place photos decoded once from base64 embedded in the generation response. No file layer, no image URLs, no image-loading library, and the Maps key never reaches the client.
- **Local notifications** for stale-quest and re-engagement reminders (v2).
- **MapKit** inline on the Quest view for location-based quests.

Folder layout: `docs/architecture/01-overview.md`.

## Data Model Quick Reference

- **UserProfile** — singleton; onboarding results + city + client-side daily-limit timestamps. `comfortZoneEdges` / `interests` / `vibes` are free-form `[String]` (preset pills + user customs — no enums; `vibes` goes over the wire as `vibe`). `locationPreferences`' `.anywhere` is mutually exclusive with the rest. Preset lists and the edge catalogue live in `Core/Models/ProfileVocabulary.swift`.
- **`comfortZoneEdges` is the app's premise made data** — what the user avoids, picked in onboarding's edge deck. Quests come back stamped with `pushesComfortZoneEdges` (which of those this quest targets, primary first). Input list vs per-quest pick — don't conflate them.
- **Quest** — `status` is `.available` / `.active` / `.completed` (no skipped state — left swipe is non-destructive); `origin` is `.personalized` or `.described`. One active quest at a time. Photos required for completion.

## Core User Flow

1. **Onboarding** — 4 resonance cards → the **edge deck** as its own full-screen beat (9 comfort-zone edges, swipe right on the ones that make you hesitate) → 4 questionnaire steps (`01 The Edge`, `02 How Far`, `03 The Draw`, `04 The Ground`) → "Generate My Quests" saves the profile and fires the first set while a 3-card walkthrough masks the ~10–20s cold generation. Nothing waits on it.
2. **Explore** — a looping Tinder-style deck opening on a **base card** (today's actions), then one quest per card. Right swipe (or ♥) → confirmation → active. Left swipe (or ✕) = "not now", never destructive. Two once-per-day actions add cards: generate a personalized set (nominally 3) or describe your own (1).
3. **Quest** — the single active quest, with map and Get Started guide.
4. **Complete** → other cards stay in the deck. **Swap** just opens the deck; the current quest stays active until another is committed, so backing out costs nothing.

**The two deck rules:** each lane replaces its own unaccepted cards — a personalized generation replaces the previous personalized cards (Rule 1); describing replaces the previous unaccepted described card, a single custom slot (Rule 2). The active and completed quests are never touched. **One exception:** onboarding's first generation appends, so a reinstalling user keeps iCloud-restored cards. Daily limits are enforced server-side; the client mirrors them for UX gating only. No reroll/dice feature — swiping is the discovery mechanism.
