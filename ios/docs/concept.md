# Horizon — Concept

## What is Horizon?

Horizon is a personal growth app that generates AI-powered real-world "quests" — challenges designed to push users out of their comfort zones and help them experience the world more fully. It's not a social media platform. It's a private, calm space where users discover curated challenges through a swipe deck (swipe right to commit, left to pass), complete them at their own pace, and document their experiences through photos and journal entries.

## Core Philosophy

- **Growth through action** — not content consumption, not social comparison
- **One quest at a time** — focus on a single quest rather than juggling multiple. Depth over breadth.
- **Discovery through choice** — a familiar scroll-and-like feed gives the user agency in selecting their next challenge. Each day they can pull a fresh set of personalized quests or describe exactly the kind of quest they want — but they still choose which one to commit to. The gesture is one people already use daily, which also makes the app's social-media marketing land on an audience that instantly "gets it".
- **A fresh chance, never a chore** — new quests appear only when the user asks for them. There are no streaks, no daily obligation, no guilt. The app offers; it never nags.
- **Minimal and calm** — the app gets out of the way and lets the experience speak for itself
- **Shareable, not social** — no feeds, no followers, no likes inside the app. But users can share their completed quests outward to their own social media as beautiful collages

## User Flow

### 1. Onboarding (Guided Setup)

The onboarding is designed to invoke a sense of meaning and intentionally guide the user from their aspirations down to logistics. It is a highly structured, paginated flow, minimizing typing by using selectable "pills".

**Intro / Resonance**
Four swipe-deck cards set the tone AND tell the gist before asking any questions — the arc is what Horizon is → how it works → the payoff → what you're about to do. Deliberately short, and with no button anywhere: this is all pre-value, so every card moves on a swipe.
- "Real-world quests, made for you." *(Small, doable adventures at real places near you — crafted around what you love and where you want to grow.)*
- "Curated for you. Chosen by you." *(Every day brings a fresh hand of quests. Swipe through them and commit to the one that calls.)*
- "Experience the world fully." *(Finished quests become stories — photos and a note in your logbook.)*
- "What makes you hesitate?" *(Ten cards, one thing each. Keep the ones that make you pause.)* — **the only card that takes a right swipe**, deliberately: it rehearses the affirmative gesture on the beat before a deck where right means "yes, that one gives me pause".

**The Edge Deck**
Its own full-screen beat, not a questionnaire step — this is the one input the whole app is built on, so it gets the whole page. Ten concrete edges arrive one per card on the app's own swipe deck — talking to strangers, eating out alone, going to events solo, being bad at something new — and the user swipes right on the ones that make them hesitate. Almost nothing else is on screen; the one exception is **Skip**, disabled until at least one edge is picked, since skipping with none only delivers the user to a step that won't let them continue.

**Everything on the card is framed around the hesitation, never the activity** — the line under each edge names the moment of friction, and the card asks plainly *"Does this make you hesitate?"* Get this wrong and the deck silently inverts: someone who *loves* talking to strangers right-swipes it, and the profile records the opposite of the truth with no way to tell afterwards. The picks are reviewed on the next screen.

**The Questionnaire Flow**
- **Step 1: The Edge** — the deck's result, laid out to be amended. Every preset is shown as a pill: swiped right = selected, swiped left = not, so a mis-swipe is one tap from fixed and nobody has to remember what they passed on. A `CustomPillInput` catches anything the presets missed. At least one edge is required to continue — a user who swiped left on all ten lands somewhere they can see that and fix it.
- **Step 2: How Far** — *"How hard should we push?"* The dial (1–5) sets how far past those edges a quest may take you, in the same words the quest cards use back: *Right at the edge of comfortable → Far beyond*, each with a line on what that will actually feel like.
- **Step 3: The Draw** — What draws their attention, and what vibe they prefer. Interests are asked for in **both tenses** — what they already love *and* what they'd like to get into — and the field says so in a line under the label, because "Interests" on its own reads as present-tense-only and quietly filters out the aspirational half. For an app about leaving your comfort zone, that half is the more useful one.
- **Step 4: The Ground** — Base city, budget, transportation, preferred environments, and any optional context.

The edge question comes first, and alone, on purpose: it's the one thing the app is actually for. Everything after it is texture and logistics.

The onboarding is **mandatory** on first launch — it cannot be skipped. It establishes the user's baseline profile, which directly shapes the quest generation.

**No sign-in, ever**
The user is never asked for an account. The backend still needs a stable identity to keep the daily generation limits honest, so the app establishes an **anonymous Firebase session** silently on its first Cloud Function call. Nothing in onboarding needs the network until the generation itself. (Why a session at all, given App Check → `developer/security-hardening-checklist.md`.)

**"How Horizon Works" walkthrough (productive waiting)**
"Generate My Quests" fires the first curated generation in the background and transitions into a short walkthrough that teaches the app while the quests generate. The first generation is always a cache miss (~10–20s), so rather than a bare spinner that time genuinely onboards the user: *swipe to choose*, practiced for real on throwaway cards that commit nothing, then *two ways to get quests*.

Three cards, and no more — what's left (one quest at a time, finishing with photos and a note) the app shows on first use, and every extra card is a chance to lose someone who hasn't seen a quest yet. It advances at the user's own pace and never waits on the generation: the last swipe drops them straight into the app. If the generation is still running, Explore's base card shows the curating progress; if it failed, nothing was inserted and the daily timestamp was never set, so the "generate a set" action is still available. Shown on first launch only.

The whole profile is editable later from Settings, so a change of city, budget, or interests never requires re-onboarding — edits shape the next generation and leave existing cards alone.

### 2. Getting Quests (Daily, Two Ways)

Horizon works on a gentle daily rhythm. Each day, the user has **two ways to add quests to their deck**, and they can use **either or both**:

1. **Generate a personalized set** — the AI produces a small set (nominally **3**, server-controlled) tailored to the user's profile. *(Backend: `generateCuratedQuests`.)*
2. **Describe your own** — the user types the kind of quest they want (e.g., "something with live music tonight"), and the AI builds **1 quest** from that description, attaching a real place and hero image just like a personalized one. *(Backend: `generateUserDescribedQuest`.)*

Each option can be used **once per rolling 24h**, so a user can add at most ~**4 new cards per day**. Both options feed into the **same swipe deck** — if the user has already generated their personalized set and then describes one, they simply have 4 cards to swipe through.

**Cards persist.** A card never disappears just because a day passed. If the user doesn't act on today's cards, they're still waiting tomorrow. New cards appear only when the user explicitly asks for them.

**What happens when you pull fresh quests — the two rules:**

- **Rule 1 — Generating a personalized set replaces the previous personalized set.** Tapping "generate" clears the user's *unaccepted personalized* cards and drops in the fresh ones. "Surprise me again" naturally means *new* surprises, and it keeps the deck small and calm.
- **Rule 2 — Describing replaces your previous custom quest.** The deck holds a **single custom slot**: creating a new described quest replaces the previous unaccepted one, so custom cards never pile up. The Describe sheet shows an inline notice naming the card at stake before the user generates. **The active quest and completed quests are never touched by any generation.**

**Discovering through swiping (the deck):**

- The deck opens on a **base card** — the first card showing what's available right now: generate a fresh personalized set, describe your own (each with its used/available state for today), or just start swiping.
- Each quest is a **card** — hero photo up top, then title, difficulty, estimated time, a short description, and categories. The next cards peek out behind the top one.
- **Swipe right** (or tap the ♥ button) to commit. Because one quest at a time is a real commitment, this asks for a quick confirmation ("Make this your quest?"). On confirm, it becomes the active quest — any previous active quest returns to the deck — and the app takes the user to the Quest tab.
- **Swipe left** (or tap ✕) means **"not now," never "never."** Passing doesn't remove the card — cards only leave the deck by being accepted or replaced by their own lane's next generation (Rules 1 & 2).
- **The deck loops.** After the last quest, the base card reappears, contextualized: "you've seen them all" — keep swiping to browse the same selection again, take a remaining daily action (generate / describe), or come back tomorrow.

**The deck is a chooser, not a wishlist.** The way to "keep" a quest you like is to commit to it. Since only one quest can be active at a time, you can't hoard favorites, and that's the point: one at a time, depth over breadth.

### 3. Quest Structure

Each quest includes:

- **Title** — short, compelling name
- **Description** — what the quest is about and why it's worth doing
- **Difficulty rating** — how challenging this quest is
- **Estimated time** — rough time commitment
- **Categories** — classification labels (e.g., adventure, creativity, connection, mindfulness)
- **The edge it pushes** — which of the user's own comfort-zone edges this quest was written for, said back on the card ("Pushes · Talking to strangers"). This is what closes the loop: you name what you avoid, and every quest tells you which one it's for.
- **Origin** — whether the quest came from a personalized set or from a description the user wrote. Described quests can show a subtle "your idea" badge.
- **Location** (optional) — a specific address for location-based quests, shown on an inline map via MapKit in the detail view. Not all quests have a location.
- **Hero image** — for location-based quests, a photo of the place sourced from the Google Maps Places API (resolved server-side by the Cloud Function). For non-location quests, a pre-loaded placeholder image bundled with the app. Displayed prominently on both the swipe card and the detail view.
- **"Get Started" button** — on-demand AI generation of a step-by-step guide for how to approach and complete the quest

### 4. Active Quest (Quest Tab)

The user has **one active quest at a time**. The Quest tab is entirely dedicated to this single quest, giving it space to breathe with rich detail:

- Full hero image
- Complete description
- Inline map for location-based quests
- Get Started guide
- Completion action

Having just one active quest keeps the experience focused. The user isn't split across multiple commitments — they pour themselves into one thing.

**Swapping:** If the user changes their mind about their active quest, they can go back to the Explore tab and like a different quest from their feed. The old active quest returns to the feed. No new quests are generated — they choose from cards they already have.

### 5. Completing a Quest

When a user completes a quest:

- Upload **one or more photos** as proof / memories (required — at least one photo needed to complete)
- Write a **journal entry** reflecting on the experience (optional but encouraged)
- The quest moves from the Quest tab to the Logbook
- The user's other cards **stay in their deck** — they can pick their next quest from what's already there, or add fresh ones (generate a personalized set or describe one, subject to the daily limits)

Completion is **binary** — done or not done. No partial completion.

Completed quests are **editable** — the user can go back and add more photos, edit their journal entry, or update anything at any time. No locking.

### 6. App Tabs

**Tab 1 — Quest (Active Quest)**
Dedicated to the user's single active quest. Shows the full quest detail with hero image, description, map, Get Started guide, and completion action. When no quest is active, shows an empty state directing the user to the Explore tab to choose one.

**Tab 2 — Explore (Swipe Deck)**
A Tinder-style swipe deck for choosing the next quest. It opens on a base card presenting today's available actions — "generate a personalized set" and "describe your own" (1 quest), each usable once per 24h — then deals one quest card at a time with the next cards peeking behind. Swipe right (with a quick confirmation) to commit; swipe left to pass without losing anything; after the last quest the base card returns in its end-of-deck form (keep swiping to browse the selection again, take a remaining action, or come back tomorrow). When the deck has no quest cards at all, only the base card shows.

**Tab 3 — Logbook (Completed Quests)**
A simple chronological view of all completed quests with their photos and journal entries. A place for the user to look back and appreciate how far they've come.

### 7. Sharing

After completing a quest, the user can share it externally:

- The app **auto-generates a collage** from the photos they uploaded
- A **template caption** accompanies the collage
- Includes a **link to the Horizon app**
- Designed for posting on the user's own social media (Instagram, Twitter, etc.)
- This doubles as the **organic marketing channel** for the app

No in-app social features. No feeds, followers, or comments.

## What Horizon is NOT

- Not a social media app — no in-app social graph
- Not a habit tracker — quests are unique experiences, not recurring habits, and there are no streaks
- Not a to-do list — the AI generates the quests, not the user
- Not a fitness app — quests span all dimensions of life experience

## Technical Constraints

- **iPhone only** (initial release)
- **Anonymous Firebase Auth**, established silently on the first generation call. The session exists only to identify the install to the backend, never to enable a social feature. Settings offers a "Delete all data" reset.
- **Data lives on device** (SwiftData) and mirrors to the user's **private iCloud database** via CloudKit, so a reinstall or new device restores the logbook in the background. No servers hold user content.
- **Offline support** for already-generated quests (viewing, completing, journaling)
- **Online required** for generating a personalized set, describing a quest, the final generation step of onboarding, and "Get Started" guides
- **Firebase Cloud Functions** as the backend for AI quest generation — the app sends user profile data (plus a free-text prompt when describing), and receives structured quest data back. The specific AI model behind the Cloud Function is a backend concern, not an app concern.
