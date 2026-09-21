# Future Features

Nothing here is built. Don't build any of it unless asked.

## Must Haves

### Quest Chains
Related quests that build on each other progressively. For example:
- "Visit a local café" → "Have a conversation with a stranger at a café" → "Become a regular at a café"

The AI generates chains based on completed quests or user interests. Chains could be opt-in — after completing a quest, the user sees "Want to go deeper?" and the AI generates a follow-up.

### Time-Sensitive Quests
Quests tied to local events happening near the user. Would require an events API (Google Events, Eventbrite, local sources) integrated into the Cloud Function. Example: "Visit the farmer's market this Saturday" or "Check out the street fair downtown this weekend."

## Nice to Haves

### Stats & Insights Page
A dedicated view showing:
- Total quests completed
- Favorite categories
- Average difficulty
- Quests per month chart
- Time spent on quests

### Accessibility Dial / Profile Flag
An accessibility setting that lets the user indicate physical limitations or preferences. The AI would then avoid generating quests that aren't suitable (e.g., hiking for someone with mobility issues). Could be a simple flag or a more detailed set of options.

## v2 services (specs)

The two side-effect services v1 doesn't ship. Both are local — no backend work.

### NotificationService

Local notifications via `UNUserNotificationCenter` with time-interval triggers, for two scenarios:

- **Stale active quest** — scheduled when a quest becomes `.active`, cancelled when it's completed or swapped. Only ever one, since only one quest is active.
- **Re-engagement** — rescheduled on each app open, pushing the trigger forward.

Permission is asked during onboarding rather than at first launch (better conversion), and a Settings toggle cancels everything. **No "new day, fresh quests" nudge** — Horizon has no streaks and never nags about the daily actions.

### ShareService

Composes a collage from the quest's photos and presents `UIActivityViewController` with the collage, a caption, and the app link as a separate share item.

Layout is auto-generated from photo count: 1 = full image with a branded border, 2 = side by side, 3 = one large + two small, 4+ = grid. A subtle Horizon watermark on all of them.

Captions are **not AI-generated** — template text with placeholders (quest title, categories) keeps sharing instant, offline-capable, and free of API calls.
