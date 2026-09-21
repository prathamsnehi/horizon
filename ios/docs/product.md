# Product behavior

Horizon is a private personal-growth app that turns what a user avoids into
small, real-world quests. It favors action over consumption, one commitment at
a time, and reflection without an in-app social graph.

## Product principles

- **Growth through action.** Quests should result in something the user does in
  the world, not more content to consume.
- **One quest at a time.** The user may browse several cards but holds one active
  commitment.
- **Choice without punishment.** A left swipe means “not now”; it never destroys
  a card. There are no streaks or daily guilt.
- **The user's edge is the premise.** `comfortZoneEdges` records what makes the
  user hesitate. Quest copy and `pushesComfortZoneEdges` must preserve that
  meaning rather than recasting an enjoyed activity as an edge.
- **Shareable, not social.** Completed stories are private in v1. External
  sharing is deferred; there are no feeds, followers, likes, or comments.

## Current flow

### Onboarding

The first-run flow is mandatory and intentionally teaches the product before
asking for detailed input:

1. Four resonance cards introduce Horizon and teach the swipe gesture.
2. A dedicated deck presents the nine preset comfort-zone edges. A right swipe
   records an edge; the next screen lets the user correct choices and add a
   custom edge.
3. Four questionnaire steps collect the edge, desired push level, interests and
   vibes, then city and practical constraints. At least one value is required
   for every structured field, and the city must be selected from MapKit search.
4. “Generate My Quests” saves the profile and starts the first curated request.
   A three-card practice walkthrough runs independently while generation is in
   flight; the app never blocks its completion on the response.

There is no sign-in UI. The first generation call silently creates an anonymous
Firebase session. Quitting mid-onboarding discards the draft and restarts the
flow next launch.

### Explore

Explore is a looping deck bookended by a base card. The base card exposes two
independent actions, each gated once per rolling 24 hours by the backend:

- **Generate personalized** returns a server-sized set, nominally three cards.
- **Describe your own** returns one card from a prompt.

The client mirrors these limits only to keep the UI honest; server time and the
authenticated uid are authoritative.

The deck follows two replacement rules:

1. A new personalized set replaces available personalized cards only.
2. A newly described card replaces the previous available described card only.

Active and completed quests are never removed by generation. The first request
launched from onboarding is the sole exception: it appends so cards restored by
CloudKit during a reinstall survive.

A right swipe or heart opens a confirmation before committing. Confirming makes
the card active and returns any prior active quest to the deck. A left swipe or
cross only advances; the card returns on the next loop.

### Quest, completion, and logbook

The Quest tab shows the single active quest, including its hero image,
description, comfort-zone receipt, activity estimate, and optional place/map
information. “Swap Quest” opens Explore without deactivating the current quest;
only committing another card performs the swap.

Completion requires at least one photo and accepts an optional journal entry.
Closing the completion form leaves the quest active. Submitting moves it to the
Logbook and deep-links to its detail page. Completed photos and journal text can
be edited later.

Settings edits the same profile fields as onboarding through a draft. Saving
changes only the profile, so existing quests and generation timestamps remain
untouched. “Delete all data” removes the SwiftData store and returns to
onboarding, but deliberately preserves the anonymous Firebase user so reset
cannot mint a fresh daily quota.

## Current boundaries

- Existing stored content is usable offline; generation requires the network.
- “Get Started” is a passive “Coming soon” card. No guide endpoint is called.
- External sharing, reminders, widgets, onboarding replay, and an About section
  are not implemented. See `backlog.md`; do not build them incidentally.
- Swift source is authoritative for exact copy, layout, and field lists.
