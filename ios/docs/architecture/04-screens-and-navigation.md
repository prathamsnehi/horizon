# Screens & Navigation

## Navigation Structure

The app uses a **TabView** as the root container with three tabs, plus a settings access point.

```
MainTabView
├── Tab 1: Quest (Active Quest)
├── Tab 2: Explore (Swipe Deck)
│         └── Settings sheet via the base card's "Tune your profile" pill
└── Tab 3: Logbook
```

## Built screens — the code is the reference

`QuestScreen`, `ExploreScreen` (deck + `BaseCard`), `DescribeQuestScreen`, `CompletionFlowScreen`, `LogbookScreen`, `CompletedQuestDetailScreen`, `SettingsScreen`, and the first-run path (`OnboardingFlowScreen`, which owns resonance → `EdgeDeckSection` → questionnaire → `WalkthroughDeck`; a reinstalling user answers the questionnaire again while iCloud restores their logbook in the background) are built; their behavior lives in `Views/`, their look in `docs/design.md`, and the deck rules in `02-data-models.md`. The cross-screen wiring worth knowing:

- **Modal presentation:** CompletionFlowScreen is a full-screen cover from the Quest tab; DescribeQuestScreen, SettingsScreen, and ShareCollageView are sheets.
- **Settings:** a sheet opened from the base card's "Tune your profile" pill (Explore). One scrollable editor of the onboarding profile fields (`SettingsScreenModel` draft → `SettingsSections`), under the questionnaire's own section names, reusing the shared form controls in `Views/Components/` and the draft rules on `ProfileDraft`. Edits live in the draft; a pinned **Save changes** button (gated on the same required-field validation as onboarding) writes them into the `UserProfile` and dismisses — swiping the sheet away discards. Saving touches only the profile (no quests, no daily-limit timestamps), so the next generation picks up the new answers.
- **Tab switching:** Committing a quest in Explore (right swipe + confirm) → Quest tab. "Swap Quest" → Explore tab. Completing a quest → Logbook tab with its new log pushed.
- **Logbook deep-link:** the Logbook `NavigationStack` uses a typed `[Quest]` path owned by `MainTabView`, so completion can push straight into the new log.
- Closing the completion form (✕) leaves the quest active — only submitting marks it `.completed`.
- **First-run wiring:** `horizonApp`'s `WindowGroup` decides the launch from `@AppStorage("hasCompletedOnboarding")` — onboarded → `MainTabView`, else `OnboardingFlowScreen`, which owns the whole flow (resonance → `EdgeDeckSection` → 4 questionnaire steps → `WalkthroughDeck`; the beats themselves are in `concept.md`, their look in `design.md`). Quitting mid-onboarding restarts it — draft persistence deferred. **No offline gate:** onboarding works fully offline; only the generate step needs the network (it establishes the anonymous session too, via `AnonymousSession`), and it fails silently — nothing inserted, daily timestamp unset, so the base card's generate action stays available.
- **Deck machinery is not shared.** Onboarding's `SwipeDeck` is physics only, deliberately separate from Explore's `DeckStack`. Each deck supplies its own accepted direction and card face through `onSwipe` and the card builder.

---

## Unbuilt screens (specs)

### ShareCollageView (modal)

- Auto-generated collage layout from the quest's photos
- Pre-configured template caption with placeholders (quest title, categories, etc.)
- Preview of what will be shared
- "Share" button → iOS share sheet (supports Instagram, Twitter, Messages, etc.)
- App link included in the share content
- Reached from a "Share" button on `CompletedQuestDetailScreen` (and optionally prompted after completion)

### SettingsScreen — future additions

The profile editor is built (see the built wiring above). Still planned as additional sections:
- **Re-take Onboarding** — restarts the guided flow. User is asked whether to clear their current quests or keep them. Completed quests are never touched. (City and every other profile field are already editable inline, so this is only for re-running the full guided experience.)
- **Notifications** — toggle notifications for stale active quest and re-engagement reminders
- **About** — app version, credits
