# Design system

Horizon uses an “Expedition Dossier” language: calm and restrained, with
editorial structure and enough physical depth to make each quest feel worth
entering. Prefer a small number of composed elements over generic controls or
ornament for its own sake.

## Principles

1. **Depth through light.** Use surfaces, soft shadows, ambient warmth, and glass
   over imagery rather than borders and decoration everywhere.
2. **Editorial hierarchy.** Numbered sections, tracked uppercase labels, clear
   titles, and hairline ornaments should read like a field journal.
3. **Motion communicates.** Continuous animation may show state or direction;
   springs may express touch physics. Avoid decorative entrance animations
   outside the intentionally cinematic onboarding and completion celebration.
4. **The content stays legible.** Important instructions do not sit directly on
   photographs, moving glass does not ride swipe gestures, and text/layout must
   survive accessibility sizes.

## Color and typography

Use asset-catalog colors rather than literals:

```swift
Color("AppBackground")
Color("AppSurface")
Color("AppPrimary")
Color("AppPrimaryText")
Color("AppSecondaryText")
```

All semantic colors support light and dark appearances; `AppPrimary` is the
same warm accent in both. New surfaces should be checked in both schemes.

Use system typography and Dynamic Type. `Eyebrow` is the numbered/section label;
`MicroLabel` is the smaller uppercase label for metadata and stats. Preserve
their hierarchy instead of creating one-off tracked labels.

## Shared pieces

Reusable UI belongs in `Views/Components/`; feature-only composition stays with
the feature. Prefer these existing pieces:

- `PrimaryCTA` and `PressableButtonStyle` for primary actions and press physics
- `ElevatedCard` for section plates; do not nest elevated cards
- `LiquidGlass` for controls floating over photos or maps. It uses real glass on
  iOS 26+ and material fallback on iOS 18; never put it on a swiping element
- `AmbientBackground` and `BreathingGlow` for restrained background motion
- `Eyebrow` and `MicroLabel` for editorial hierarchy
- `FlowLayout`, `SelectablePillGrid`, and `ProfilePillField` for profile fields
- `CategoryChips`, `EdgeBadge`, and `DifficultyPips` for quest metadata
- `HeroImageView` for stored place imagery and its bundled fallback
- `PhotoControls` and `CameraPicker` for completion/logbook media

Feature-specific components live under `Views/<Feature>/Components/`. Extract a
shared component only after the behavior and visual contract actually match.

## Interaction rules

- A quest card keeps stable content while it is dragged; movement should be
  transforms, not a body rebuilt around per-frame verdict UI.
- Right-drag may warm the ambient background. Left-drag stays neutral because
  “not now” is not a negative or destructive action.
- The swipe threshold emits one selection haptic; commit and completion use
  success feedback. Avoid haptics for passive transitions.
- A primary action is visually singular on a screen. Secondary actions use
  quieter pills, glass controls over imagery, or text treatment as appropriate.
- Forms put validation near the affected input and keep their primary action
  keyboard-safe using a bottom safe-area inset.
- City values must come from the MapKit suggestion flow, not an unconstrained
  text field; selected coordinates are part of the profile.
- The edge-deck question is always framed around hesitation. Copy that sells an
  activity can invert the user's answer and corrupt downstream personalization.

## Feature patterns

- **Onboarding** is the exception that permits one-time choreography. It uses
  the resonance deck, nine edge cards, a four-step questionnaire, and a
  three-card practice walkthrough.
- **Explore** uses a base card plus quest cards in a looping physical stack.
  Commit needs confirmation; pass remains nondestructive.
- **Quest and Logbook** use numbered elevated sections, a strong hero, and a
  colophon rather than dense dashboard chrome.
- **Completion** reserves its short confetti burst for the app's most important
  emotional beat. The form itself remains calm and single-page.
- **Settings** reuses onboarding fields without onboarding cinematics. Changes
  remain in a draft until the pinned Save action succeeds.

Exact copy, spacing, and screen composition live in SwiftUI source. This file is
for durable system rules; do not turn it back into a screen-by-screen transcript.
