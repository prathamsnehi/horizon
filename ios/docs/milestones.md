# Milestones

Status of the app against v1 (TestFlight). The original phase-by-phase build plan
is done and has been retired — for how anything works, the code is the reference
and the architecture docs carry the decisions.

## Built

The whole core loop ships: **onboarding** (resonance deck → 4-step questionnaire
with a MapKit city picker → walkthrough that teaches by doing while the first set
generates — no sign-in anywhere), the **Explore** swipe deck with its base
card and two daily actions, the **Quest** tab, the **completion flow**, the
**Logbook** (timeline + editable log pages), and **Settings** as a full profile
editor.

Behind it: SwiftData models mirrored to iCloud via CloudKit, `CloudFunctionService`
wired to `generateCuratedQuests` / `generateUserDescribedQuest`, anonymous
Firebase Auth (silent, no sign-in screen) with a "Delete all data" reset, App
Check, and client-side generation gating that reconciles against the backend's
`retryAt`.

The backend is production-ready: auth + App Check enforced, server-side 24h
rolling limits keyed on the auth uid, pre-generation cache, multi-provider LLM
routing, and cost caps. See `docs/architecture/03-api-contracts.md`.

## Remaining for v1

**CloudKit**
- [ ] Exercise the Development schema on a real device: complete a quest with photos + journal, generate a described quest, and pick a quest with a location — CloudKit's just-in-time schema only creates fields it has *seen*, and unseen fields fail in production
- [ ] CloudKit Console → **Deploy Schema Changes to Production** (append-only afterward)

**Firebase console** — the single list; `developer/security-hardening-checklist.md` explains why each matters
- [ ] **Enable the Anonymous provider** (Authentication → Sign-in method). Off by default, and without it `signInAnonymously()` fails `operation-not-allowed` and *every* generation dies
- [ ] Disable the **Apple** provider, now that the sign-in-free build ships
- [ ] Re-set the developer `exempt` flag on the new anon uid — the old Apple-signed-in uid's `rateLimits` doc no longer applies
- [ ] Confirm App Check uses the **App Attest** provider in Release builds (debug provider is dev-only)
- [ ] Set App Check enforcement to **Enforced** for Cloud Functions

**Release prep**
- [ ] **Remove the debug rate-limit bypass** — `GenerationLimit.debugBypassesDailyLimits` (Debug-only, so it can't ship, but flip it to `false` and QA the recharge plate before release)
- [ ] Clear `exempt: true` from any `rateLimits/{uid}` dev docs
- [ ] Version + build number bump
- [ ] Real-device QA: both color schemes, airplane mode, denied camera/photo permissions, rapid swipes, deck of exactly 1 quest, both daily actions spent, many completed quests
- [ ] Verify a completed quest leaves the Quest tab and its empty state points to Explore
- [ ] Accessibility pass — VoiceOver labels, Dynamic Type
- [ ] App Store Connect: privacy policy URL, App Privacy labels, screenshots, age rating

## Deferred to v2

- **Get Started guide** — the UI shows "Coming soon"; the `generateGetStartedGuide` backend handler isn't wired up yet
- **Sharing** — `ShareService` + `ShareCollageView` (specs in `future-features.md` and `04-screens-and-navigation.md`)
- **Notifications** — `NotificationService` for stale-quest and re-engagement reminders, plus the permission ask and the Settings toggle (spec in `future-features.md`)
- **Re-take onboarding** from Settings, and an About section
- **Widget** — active quest on the home screen
