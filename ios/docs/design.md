# Design

## Design Philosophy — "The Expedition Dossier"

Horizon's design language treats every quest like a crafted expedition dossier: editorial typography, physical depth, and quiet living details. The app is still **minimal and calm** — but minimalism comes from *restraint*, not absence. Few elements, each one crafted.

Three pillars:

1. **Depth through light** — pages are never flat. Soft ambient glows warm the background, sections rise on elevated plates with real-feeling shadows, and glass floats over imagery. Depth is done with light (shadows, glass refraction) — never with decoration.
2. **Editorial, not app-like** — tracked-out uppercase micro-labels, numbered sections, free-flowing stats, hairline ornaments. The screen reads like a beautifully typeset field journal, not a form.
3. **Motion with purpose** — the only animation allowed is either *continuously meaningful* (a marching trail, a pulsing map beacon, scroll-linked parallax) or *physical feedback* (spring press-scaling). No one-shot entrance choreography: it's extra code for something seen once.

The experience is still about the real world — the app's job is to make the user's next real-world story feel worth walking into.

## The Language (system pieces)

These are the reusable ingredients, all implemented in `Views/Components/`:

| Piece | Component | Rules |
| --- | --- | --- |
| **Eyebrow** | `Eyebrow` | `.caption` semibold, `tracking(2.4)`, uppercase; optional bold `AppPrimary` index ("01", "02") for numbered sections |
| **Micro-label** | `MicroLabel` | `.caption2` medium, `tracking(1.5)`, uppercase, `AppSecondaryText` — the smaller of the two, naming a stat, a field, or a date. Lives beside `Eyebrow` in `EditorialLabels.swift` |
| **Primary CTA** | `.primaryCapsule(isEnabled:)` / `.primaryCTA` | `.headline` black label on a two-stop `AppPrimary` gradient capsule, full width, dimmed to 0.4 when disabled. The modifier is the whole button; the bare `.primaryCTA` shape style is for the few places with a different footprint (the ♥ circle, the empty state's hugging pill, the confirm dialog's half-row) |
| **Elevated card** | `.elevatedCard()` | Section container: `AppSurface`, corner radius 24, 20pt padding, two-layer shadow (tight 3pt contact + soft 18pt ambient). No edge strokes. Never nest elevated cards or stack them on each other |
| **Liquid Glass** | `.liquidGlass(in:tint:)` | Real `glassEffect` on iOS 26+, `.ultraThinMaterial` fallback earlier — the availability check lives in this one wrapper. Glass only *floats over rich content* (photos, maps); never on flat backgrounds, never mixed into plates, and **never on elements that move with a gesture** (swiped cards) — it re-samples the moving background and shimmers; use a static `black.opacity(0.45)` scrim there instead |
| **Press physics** | `PressableButtonStyle` | Every tappable element spring-scales to 0.92 on press |
| **Ambient glow** | `AmbientBackground`, `QuestPanelBackground` | Background = `AppBackground` + two soft radial `AppPrimary` glows (≈0.06–0.16 opacity) in opposite corners. `BreathingGlow` adds a third that slowly breathes, for onboarding's two full-screen decks |
| **Tag flow** | `FlowLayout` + `CategoryChips` | Chips keep natural single-line size, wrap like tags, sorted shortest-first for even rows; ghost style (hairline stroke, no fill). An optional `limit` collapses overflow into a `+N` chip — used on swipe cards so a tag-heavy quest can't push the ✕/♥ buttons down; detail screens show all |
| **Hero imagery** | `HeroImageView` | Renders `Quest.locationPhotoData` bytes (embedded in generation responses — no URLs, no image-loading library); nil falls back to the bundled placeholder asset. Decoding goes through `PhotoCache`, since a card's body re-runs on every frame of a drag |
| **Micro-label stats** | `QuestStatisticsSection` | A `MicroLabel` over a `.title3` semibold value; free-floating, no containers or rules |
| **Ornaments** | `QuestTrailDivider`, `QuestColophon` | Jewelry that carries meaning: an animated dotted trail carrying journey stats; a — ● — closing mark. One or two per screen, never more |
| **Edge badge** | `EdgeBadge` | `PUSHES` tracked micro-label + the comfort-zone edges a quest targets, in `AppPrimary`. Optional `limit` collapses overflow into `+N` (same rule as `CategoryChips`) — dense surfaces pass `limit: 1`, roomy ones show all. Renders nothing when the array is empty |

**Glow discipline:** no colored glow shadows on buttons or cards. The only glows are the ambient background washes and data-carrying accents (e.g., difficulty color on its value).

## UX Principles

- **Haptic feedback throughout** — satisfying haptics on key interactions: liking/committing to a quest, completing a quest, swapping quests, generating a personalized set, submitting a described quest. Tactile and rewarding.
- **Commitment deserves a beat** — committing to a quest is the app's biggest action; it gets a quick confirmation ("Make this your quest?"). Everything else is one tap.
- **A fresh chance, never a chore** — new quests appear only on the user's request. No streaks, no daily-obligation UI, no guilt framing anywhere.
- **Forgiving by default** — no skip, no delete; passing on a card (left swipe) never destroys anything, and the deck loops. The only replacements are the user's own generation requests — a fresh personalized set (Rule 1) or a new custom quest (Rule 2, with an inline warning).
- **Dark and light mode** — full support for both via the asset palette. Depth cues adapt: shadows carry elevation in light mode; in dark mode the lighter `AppSurface` against the background carries it.
- **Tap targets are generous** — a control's hit area is the whole row or a padded halo around it (`.contentShape`), never just the glyph.

## Color Scheme — "Igneous Core"

Inspired by Google Stitch's Igneous Core theme. Warm, grounded, with a signature orange primary. All colors are declared as custom color assets in `Assets.xcassets` and accessed via `Color("AppColorName")` — never hardcode hex values.

### Colors

| Token                | Light                         | Dark                       | Usage                                                   |
| -------------------- | ----------------------------- | -------------------------- | ------------------------------------------------------- |
| **AppBackground**    | `#F0F0F5` (soft cool gray)    | `#000000` (true black)     | Page/screen background (+ ambient glows)                |
| **AppPrimary**       | `#FFB693` (warm peach-orange) | `#FFB693` (same)           | Buttons, accents, eyebrows' indices, beacons, glows     |
| **AppSurface**       | `#FFFFFF` (white)             | `#1C1C1E` (near-black)     | Elevated plates and cards                               |
| **AppPrimaryText**   | `#1C1B1B` (near-black)        | `#E5E2E1` (warm off-white) | Headings, body text, primary labels                     |
| **AppSecondaryText** | `#737373` (mid gray)          | `#A3A3A3` (light gray)     | Micro-labels, metadata, hairlines/ornaments (low opacity) |

Semantic accents ride on top of the palette: comfort zone maps to `.green` / `.orange` / `.red` / `.purple` (Within → Far beyond) and is the one place a section may show non-brand color. Gradient use is limited to the primary CTA (`.primaryCTA`, declared once) and legibility scrims over photos — a flat `AppPrimary` fill on a primary action is drift, not a variant.

### Usage in SwiftUI

```swift
Color("AppBackground")      // screen background
Color("AppPrimary")          // buttons, accents
Color("AppSurface")          // plate/card fill
Color("AppPrimaryText")      // titles, body text
Color("AppSecondaryText")    // micro-labels, metadata, hairlines
```

## Typography

Apple's **SF font** (system font) everywhere — uniform, no custom fonts, no serif. Use SwiftUI's built-in Dynamic Type text styles exclusively. No hardcoded point sizes (no `.system(size: 22)`). This keeps everything consistent and scales automatically with accessibility settings.

Type is role-based rather than per-screen-prescribed:

| Role | Style | Notes |
| --- | --- | --- |
| Hero / display title | `.largeTitle` bold | Usually white over imagery with a scrim |
| Screen & place titles | `.title2` / `.title3` semibold | |
| Eyebrow | `.caption` semibold, `tracking(2.4)`, uppercase | Via the `Eyebrow` component |
| Micro-label (stats) | `.caption2` medium, `tracking(1.5)`, uppercase | |
| Stat value | `.title3` or `.subheadline` semibold | |
| Body | `.body`, `lineSpacing(5)` on long text | |
| Metadata / chips / ornament text | `.footnote` / `.caption` | Secondary color |
| Buttons | `.headline` (primary), `.subheadline` medium (secondary) | |

## Component Design

### Quest Page (Quest Tab — Active Quest) — *built, reference implementation*

The flagship screen; everything else should speak its language.

- **Hero** (~48% of screen height): the photo, uninterrupted — full-bleed to the top edge, rounded off at the bottom (32), carrying **no text, badge, or button**. Only a soft top scrim so the clock and battery stay legible. It scrolls with the page and stretches on pull-down; its *layout* height stays fixed, so the growth is purely visual and nothing below it shifts.
- **Masthead**: directly under the hero, the place name in `.largeTitle` bold with the distance riding its baseline as a tracked uppercase micro-label ("Dolores Park · 2.4 MI"). On quests with no place, the quest title takes this slot instead, and The Briefing drops its own title so it's never said twice.
- **Content panel**: square-topped page with ambient glows (the hero above supplies the curve; a second rounding at the same seam pinches it).
- **Stats**: Comfort Zone (the difficulty's `displayName` — "Within" … "Far beyond" — tinted in its difficulty color) and Activity Time as centered micro-label stats — free-floating, no boxes.
- **Numbered sections on elevated plates**: `01 The Briefing` (the **quest title** as its headline, then description + ghost category chips), `02 The Place` (name/address → animated **journey trail** `icon ─ ─ 3.0 mi · 10 min ─ ─ 📍` with the recommended-mode icon → 3D map → per-mode travel chips with the recommended one highlighted → italic editorial note with an `AppPrimary` accent bar), `03 Field Guide` (placeholder row until the backend lands).
- **Map card**: 3D camera (distance 350, heading 30, pitch 75, realistic elevation, POI excluded), pulsing `AppPrimary` beacon annotation, floating glass "Open in Maps ↗" pill; tap opens the Google Maps URL.
- **Actions**: "I Did It" as the gradient `AppPrimary` capsule CTA; "Swap for another quest" as a quiet interactive glass capsule beneath.
- **Colophon**: — ● — with "Accepted N days ago" closes the page.
- **Empty state**: ambient glow page, breathing compass icon, "Your next story awaits.", gradient CTA to Explore.

### Swipe Deck (Explore Tab) — *built*

A Tinder-style card deck on the ambient background. A cycle is `[base card, quest 1 … quest N]`, repeating forever — the deck loops, and nothing is ever destroyed by a swipe. Cards fill nearly the whole screen: 28pt of breathing room below the top safe area and the same above the tab bar.

**Card anatomy (`SwipeQuestCard`):** rounded-32 `AppSurface` card, dual-layer shadow (on the background shape, not the content — cheap to move). Photo fills the top ~50% with two static scrim badges (place pin + name · distance bottom-left; "N of M" counter top-right, with the "YOUR IDEA" badge stacking beneath it on described quests). Below: title, difficulty pips + level + activity time, 3-line description, ghost category chips, and the ✕/♥ action buttons at the card's bottom.

**Stack & physics:**
- Three cards visible: top card full-size, the next two peeking behind (scaled down 6% per depth, offset 14pt). As the top card drags, **the next card lifts toward full size** in real time.
- Drag follows the finger with **rotation anchored at the bottom** (~1° per 18pt); release springs back under the threshold (120pt), or flies out on distance/flick velocity.
- The ambient background **warms with AppPrimary on right-drags only** — left-drags never dim the room.
- **Card content never rebuilds mid-drag** — the card's inputs stay constant during a gesture, so a drag is pure transforms (no verdict stamps or other per-frame content changes inside the card).
- Haptics: selection tick when crossing the swipe threshold, light tick on pass, success on commit.
- **No Liquid Glass on anything that moves with the gesture** — glass re-samples the moving background and shimmers; badges use static `black.opacity(0.45)` scrims instead.

**Gestures & buttons:**
- **Swipe right / ♥ button** → commit: the card hangs mid-flight while the confirmation card appears ("Make this your quest?"); "Not yet" springs it back into the deck; confirm → active (any previous active returns to the deck) → Quest tab.
- **Swipe left / ✕ button** → "not now": card flies out, deck advances; the card returns next cycle.
- ✕ (glass circle) and ♥ (gradient circle) buttons with quiet labels (`DeckActionButtons`) live **inside the quest card**, at the bottom of its details section. The base card has none.

### Base Card (Deck Start / End) — *built*

A card that bookends the deck — the first card the user lands on, and the card shown again after the last quest (the deck loops through it). Same card shell as quest cards (`AppSurface`, rounded 32, dual-layer shadow).

- **Start form:** shows today's available actions with used/available states:
  - **"Generate personalized"** — primary gradient capsule. Adds 3 quests; per Rule 1 it first clears unaccepted personalized cards, then inserts 3 fresh. Once used today, disabled with a quiet "come back tomorrow" hint. While generating, the buttons swap for the **curating progress bar** (`CuratingProgressView`): eases toward ~92% over ~10s with rotating status lines, sprints to full when the response lands, then the deck reveals the first fresh card.
  - **"Describe your own"** — stroked capsule (static, not glass — it rides a swipeable card). Opens the Describe sheet; adds 1 quest into the single custom slot (Rule 2: replaces the previous unaccepted described card). Disabled once used today.
  - A prominent "or just start swiping" cue with a left-bobbing `AppPrimary` arrow when quest cards exist.
- **End form:** same card, contextualized — "You've seen them all." Keep swiping to browse again, take a remaining daily action, or come back tomorrow.
- When the deck has no quest cards at all, the base card is the only card (both-actions-used state reads "You're all set for today — come back tomorrow for fresh quests.")
- Neither action uses streak language or countdowns beyond a gentle "available again tomorrow."

### Describe Quest (Modal Sheet) — *built*

- A single clean text input, large tap target, placeholder like "What kind of quest are you in the mood for?"
- Optional example prompt chips (ghost style, e.g., "live music tonight", "something with water") to inspire input and reduce typing friction
- When an unaccepted custom quest already exists, a quiet inline notice (⚠ on a soft `AppPrimary` wash, naming the card) warns that creating a new one replaces it — no blocking dialog
- "Create" button triggers generation; shows a "curating" state (always live, ~10–20s) with a subtle animation
- **Keyboard-safe structure:** one `.large` detent (a form plus keyboard doesn't fit `.medium`, and re-resolving detents mid-edit is what makes a sheet jump), content in a `ScrollView` so nothing is ever compressed or truncated, and the CTA pinned via `safeAreaInset` on the same clear→background fade as Settings — so the keyboard lifts it rather than burying it. The button and the curating bar swap in that pinned slot, so the form above never reflows when generation starts
- On success, the new card is added to the feed and the sheet dismisses
- Unavailable state when the daily describe action is already used

### Onboarding Flow (Guided UI) — *built*

**Onboarding is the app's second declared exception to the no-one-shot-animation rule** (the confetti being the first): a cinematic first-run with staggered text reveals and directional step transitions, seen exactly once.

- Resonance overture: **four** editorial copy cards delivered **on the app's own swipe deck** (`ResonanceDeck` on the shared `SwipeDeck`) over a **breathing glow** (`BreathingGlow`). The user learns the core gesture (swipe left, animated hint below the deck) before any question. **No button on any card, including the last** — this is all pre-value, and a CTA competing with the swipe both breaks the immersion and teaches the wrong thing
- **The 4th card takes a right swipe.** Each deck declares its own accepted direction in its `onSwipe`; the walkthrough's commit card additionally awaits `CommitConfirmCard` before the deck advances. A swipe the wrong way nudges rather than advances
- Each resonance card carries **one large SF Symbol** (`ResonanceSymbol`, ~96pt light, `AppPrimary`) that **fades in when its card is revealed** (becomes the top card — not on creation, since cards pre-render behind the deck), settles with a **single one-shot symbol effect**, then holds still: `map.fill`, the angled card stack, `sun.horizon.fill` (`.bounce`), and `figure.walk.departure` (`.wiggle`). No looping motion on these cards
- **Expedition-trail progress** (`TrailProgress`): one ● node per step on a hairline — passed nodes fill `AppPrimary`, the current node pulses; the colophon/timeline motif as a progress bar
- **The edge deck** (`EdgeDeckSection`) — the app's premise asked with the app's own gesture, and **a beat of its own between resonance and the questionnaire, not a step inside it**. It's the one input everything is built on, so it gets the whole page: `ZStack { BreathingGlow; SwipeDeck }` at nearly the resonance deck's insets (24 / 16 / 28, riding higher to clear the **Skip** capsule under it) and nothing else — no trail, no headline. **No swipe hint either** (`SwipeDeck`'s `hint` closure is optional and this deck omits it), because the card states its own verdict — which also makes these cards ~34pt taller than a resonance card, since the hint row collapses
- Ten edge cards on the `SwipeDeck` machinery, fed `ComfortZoneEdge.presets` directly, built to **`SwipeQuestCard`'s anatomy**: the photo fills the top **50%** with the `N of 10` capsule over it (static `black.opacity(0.45)`, not glass) and the photographer credit — camera glyph + `@handle` on a glass capsule — opposite it at the bottom, hidden when `photoCredit` is empty. Everything to read sits below on `AppSurface` — the edge (`.title` bold), its one evocative line, then the question and the **real `DeckActionButtons`** relabelled ✕ "← Not really" / ✓ "Yeah →", the same component Explore uses so the two decks can't drift. The text half is centered rather than leading, since it's a question and two answers rather than a dossier. A missing photo asset falls back to a bundled sample (the way `HeroImageView` stands in for photoless quests), so the deck is never broken mid-shoot. Cards accept **either** direction — the only deck where both mean something, so its `onSwipe` always returns true and records only the right swipes
- **Text that matters does not sit on a photograph** — a label over an image gets skimmed, so this card takes Explore's photo/surface split rather than a full-bleed scrim
- **The card is the deck's only instruction**, so it states the task at rest rather than relying on motion. **The question sits directly above the buttons** — *"Does this make you hesitate?"*, `.headline` in `AppPrimaryText`, grouped with them in one `VStack` — so the reading order is *thing → question about the thing → answers*, and **the button labels carry outward arrows** so each answer names its own direction
- **Framing is the whole ballgame on this card, and it is easy to invert.** Every element must point at the hesitation and never at the activity: `ComfortZoneEdge.subline` names the moment of friction, the question asks about that moment, and neither answer parses on its own. Sell the activity instead ("The person next to you has a story") and an extrovert right-swipes for the opposite reason, storing the inverse of the truth with nothing downstream able to detect it
- **Four steps**: `01 The Edge` (a `SelectablePillGrid` over **every** preset edge — swiped-right selected, **swiped-left shown unselected**, so a mis-swipe is one tap from fixed — with a `CustomPillInput` and a title that counts the picks), `02 How Far` (the dial), `03 The Draw` (interests + vibes), `04 The Ground` (city, budget, transportation, environments, optional notes). All four are forms and all four scroll
- **The how-far dial** (`ComfortZoneDial`) gets a step to itself. Its captions speak the quest cards' own language (*Right at the edge of comfortable → Far beyond*) so what you set is what you read back, and each carries a second line on what that will actually feel like
- Questionnaire steps: numbered `Eyebrow` headers (`StepHeader`), **selectable pills** (`SelectablePillGrid` — ghost unselected, `AppPrimary`-washed selected, spring + selection haptic per toggle) via `FlowLayout`
- **Custom pills** (`CustomPillInput`, dashed capsule): vibes, interests, and comfort-zone edges accept user-added entries alongside presets
- **"Anywhere" is an exclusive pill** in Environments: selecting it visibly springs the other pills to deselected (the rule is seen, not silent)
- **City is picked, never typed loose** (`CityPickerMap` + `CitySearch`): type-ahead locality suggestions disambiguated with state/country ("St. Paul, MN"), exact coordinates captured at selection, and a map that flies to the chosen city with a pulsing `AppPrimary` beacon; the step can't advance until a suggestion is picked
- Steps slide in from the direction of travel (forward = trailing edge); Back is a quiet stroked circle, Next a gradient capsule disabled until the step validates
- Final step's **"Generate My Quests"** (sparkles, not the arrow the other steps carry) saves the profile with the picked city's exact coords, fires the first generation, and hands off to the walkthrough

### "How Horizon Works" Walkthrough — *built*

- Shown once, right after "Generate My Quests", masking the ~10–20s first-run generation — taught **by doing, on a tutorial deck** (`SwipeDeck`, deliberately separate from Explore's `DeckStack` machinery)
- Two **practice cards render the real `SwipeQuestCard`** fed throwaway quests (bundled `sample-image` photos, never inserted into SwiftData): an actual left swipe (*pass*), then an actual right swipe through the real `CommitConfirmCard` (*commit — celebrates, commits nothing*). Each card prescribes its gesture; wrong directions spring back and the hint below the deck emphasizes
- **One** info card follows (swipe left), a **story-telling vignette rather than a static icon** (`WalkthroughDemos`): the two daily action capsules dealing miniature card fans — the one lesson practice can't show
- **There is no closing pane** — the last swipe drops the user straight into the app, and nothing ever waits on the generation (`FirstGenerationStatus` carries the curating state to Explore's base card)

### Logbook (Tab 3) — *built*

- **Vertical timeline**: a 1px rail down the left with a small ● `AppPrimary` node per entry (the colophon's mark, reused as a motif), the completion date as a tracked uppercase micro-label, and a compact log card (`AppSurface`, rounded 18): first-photo thumbnail, title, journal/place snippet, chevron
- Header: Eyebrow "The Logbook" + "Your story so far." + quest count
- Tap a row → the full log page (`CompletedQuestDetailScreen`), **read-only until the toolbar Edit button is tapped**. Numbered plates like the quest page: `01 The Gallery` (photos; in Edit mode add from library/camera, ✕ to remove), `02 The Story` (journal as text; a field in Edit mode, autosaved), `03 The Place` on location quests (Google place photo, name/address, 3D map, editorial note — no travel logistics), `04 The Quest` (original description, place, categories), closed by the colophon with the completion date
- Calm empty state: closed book icon, "No stories yet."

### Settings — *built*

- A sheet from the base card's "Tune your profile" pill (Explore). The onboarding questionnaire recomposed as **one calm scroll** — header (Eyebrow "Settings" + "Tune your profile." + a line noting changes shape the next set, existing cards stay) over five numbered sections, reusing the same pill grids, dial, city picker map, and context field — but **none of the cinematics** (the staggered reveal is onboarding's declared exception; Settings has no one-shot motion)
- **The section names are the questionnaire's**, deliberately: `01 The Edge` · `02 How Far` · `03 The Draw` · `04 The Ground` · `05 The Details`. The same field must never be called two different things depending on where you edit it. (Step 05 has no questionnaire counterpart — the optional notes ride inside The Ground there.) The edge deck itself doesn't come back; `01 The Edge` is a pill grid, since re-running a swipe deck inside a settings sheet would be a chore
- Edits live in a draft; a **Save changes** capsule pinned to the bottom (`safeAreaInset`, over a clear→background fade) is gated on the same required-field validation as onboarding (dimmed until valid). Save writes the profile + success haptic + dismiss; swiping the sheet away discards
- The shared form controls live in `Views/Components/` (`SelectablePillGrid`, `CustomPillInput`, `CityPickerMap`, `ComfortZoneDial`, `MicroLabel`) and the draft rules on `ProfileDraft`, which both `OnboardingFlowScreenModel` and `SettingsScreenModel` conform to — the toggles, the "anywhere" exclusivity, the custom-pill trim/dedupe, the validity gate, and the write-back to `UserProfile` are defined once

### Share Collage — *not built (v2)*

- Branded frame/border around the collage
- Subtle Horizon watermark
- Layout adapts to photo count:
  - 1 photo: full image with branded border
  - 2 photos: side by side
  - 3 photos: one large + two small
  - 4+ photos: grid layout

### Completion Flow — *built*

- Tapping "I Did It" fires a **~1.5s confetti burst** over the quest page — the one deliberate exception to the no-one-shot-animation rule, reserved for the app's biggest emotional beat. Nothing is marked complete yet. It's a `CAEmitterLayer` behind a `UIViewRepresentable` (`ConfettiBurstView`), deliberately not SwiftUI `Canvas`: the render server simulates the particles off the main thread, so the burst can't cost frames over the hero image.
- Then a full-screen **single-page form** ("Set it in memory."): `01 The Evidence` — photo thumbnails with ✕ remove, sources = library picker + camera capture, at least one required; `02 The Story` — optional journal, placeholder "How was it?"; one gradient "Complete quest" CTA (dimmed until a photo exists)
- Closing the form (✕) leaves the quest active — submit is the only thing that marks `.completed`
- On submit: photos JPEG-encoded onto the quest (`journalPhotoData`), success haptic, and the app deep-links to the new log page in the Logbook tab

### Widget — *not built (v2)*

- Small widget: shows title of current active quest
- Tapping opens the app to the Quest tab
- If no quest is active, shows "No active quest" with a prompt
