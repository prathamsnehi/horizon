# iOS backlog

This file records intentional gaps so they are not mistaken for missing pieces
of current work. Build an item only when it is explicitly requested; refine its
product and technical design at that time instead of treating these notes as a
complete specification.

## Deferred product work

- **Get Started guide:** the Quest screen currently shows a passive “Coming
  soon” card. Backend request/response types exist, but no callable handler or
  client workflow is implemented.
- **External sharing:** collage generation, template captions, app-link content,
  and the system share sheet.
- **Local reminders:** optional stale-active-quest and re-engagement reminders,
  including permission timing and a Settings toggle. This should use local
  notifications; no remote-notification backend is planned.
- **Settings additions:** replay onboarding and an About section.
- **Widget:** show the active quest on the Home Screen.
- **Later exploration:** quest chains, time-sensitive local-event quests,
  completion insights, and explicit accessibility preferences for generation.

## Engineering gaps

- Add an `horizonTests` target and shared scheme coverage for profile draft
  rules, generation windows, quest transitions, response decoding, and deck
  replacement behavior.
- Add a macOS iOS-build CI job once signing-independent builds are stable.
- Review the existing `remote-notification` background mode and `aps-environment`
  entitlement. Remove them if the local-only reminder direction remains; do not
  let unused push capabilities imply a nonexistent FCM architecture.
- Add an accessibility pass for VoiceOver, Dynamic Type, Reduce Motion, contrast,
  and camera/photo permission failure states.

Cross-system release and console verification is tracked once in
`../../docs/operations/release-checklist.md`.
