//
//  BaseCard.swift
//  horizon
//
//  Bookends the feed: the first page (today's actions) and the page
//  after the last quest (end-of-feed form, since the feed loops).
//

import SwiftUI

struct BaseCard: View {
    enum Form {
        case start, end
    }

    let form: Form
    let hasQuests: Bool
    let isGenerating: Bool
    let generationCompleting: Bool
    /// Last time each action ran — drives the 24h recharge gating. `nil`
    /// means never used (available now).
    let curatedLast: Date?
    let describedLast: Date?
    let onGenerate: () -> Void
    let onDescribe: () -> Void
    let onTuneProfile: () -> Void

    var body: some View {
        ZStack {
            VStack(spacing: 14) {
                Spacer()

                Eyebrow(
                    text: form == .start ? "Today's Quests" : "End of the Line",
                    color: Color("AppPrimary")
                )

                Text(headline)
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundStyle(Color("AppPrimaryText"))
                    .multilineTextAlignment(.center)

                Text(subtitle)
                    .font(.body)
                    .foregroundStyle(Color("AppSecondaryText"))
                    .multilineTextAlignment(.center)

                Group {
                    if isGenerating {
                        CuratingProgressView(isComplete: generationCompleting)
                            .padding(.vertical, 24)
                    } else {
                        VStack(spacing: 14) {
                            DailyActionButtons(
                                curatedLast: curatedLast,
                                describedLast: describedLast,
                                onGenerate: onGenerate,
                                onDescribe: onDescribe
                            )
                            TuneProfileButton(action: onTuneProfile)
                                .padding(.top, 4)
                        }
                    }
                }
                .padding(.top, 18)

                Spacer()

                if hasQuests {
                    SwipeCue(text: form == .start ? "swipe to view curated adventures" : "keep swiping to browse again")
                        .padding(.bottom, 20)
                }
            }
            .padding(.horizontal, 32)
        }
        .background(
            RoundedRectangle(cornerRadius: 32)
                .fill(Color("AppSurface"))
        )
    }

    private var headline: String {
        switch form {
        case .start: "Where will today take you?"
        case .end: "You've seen them all."
        }
    }

    private var subtitle: String {
        switch form {
        case .start:
            hasQuests
                ? "Pull a fresh set, describe your own, or swipe through what's waiting."
                : "Pull a fresh personalized set, or describe exactly what you're after."
        case .end:
            "Keep swiping to browse them again, or add something new."
        }
    }

}

/// The two daily actions, each gating itself on its own 24h window: the
/// live button when available, or a dimmed recharge plate when spent.
/// The TimelineView keeps the bars and "Ready …" times current, and
/// flips an action back to its button the minute its window elapses.
private struct DailyActionButtons: View {
    let curatedLast: Date?
    let describedLast: Date?
    let onGenerate: () -> Void
    let onDescribe: () -> Void

    var body: some View {
        TimelineView(.periodic(from: .now, by: 60)) { context in
            let now = context.date
            VStack(spacing: 14) {
                if let ready = GenerationLimit.readyDate(since: curatedLast, now: now) {
                    RechargePlate(
                        title: "Generate Your Set",
                        readyText: Self.readyText(for: ready, now: now)
                    )
                } else {
                    GenerateSetButton(action: onGenerate)
                }

                if let ready = GenerationLimit.readyDate(since: describedLast, now: now) {
                    RechargePlate(
                        title: "Describe Your Own",
                        readyText: Self.readyText(for: ready, now: now)
                    )
                } else {
                    DescribeOwnButton(action: onDescribe)
                }
            }
        }
    }

    /// Unambiguous within a ≤24h window: a clock time, tagged "tomorrow"
    /// when it lands on the next calendar day. Kept to two words so the
    /// plate's single row never wraps.
    private static func readyText(for date: Date, now: Date) -> String {
        let time = date.formatted(date: .omitted, time: .shortened)
        return Calendar.current.isDate(date, inSameDayAs: now)
            ? "Ready \(time)"
            : "Tomorrow \(time)"
    }
}

private struct GenerateSetButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                Text("Generate Your Set")
            }
            .primaryCapsule()
        }
        .buttonStyle(PressableButtonStyle())
    }
}

private struct DescribeOwnButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: "square.and.pencil")
                Text("Describe Your Own")
            }
            .font(.subheadline)
            .fontWeight(.medium)
            .foregroundStyle(Color("AppPrimaryText"))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            // Static stroke, not glass — glass misbehaves on a card
            // that moves while being swiped.
            .background(
                Capsule().strokeBorder(Color("AppSecondaryText").opacity(0.35), lineWidth: 1)
            )
        }
        .buttonStyle(PressableButtonStyle())
    }
}

/// A spent daily action, reduced to one quiet row: title left, ready
/// time right. The dimmed, inert plate is the whole "locked" signal —
/// no lock, no progress. Not a Button — tapping does nothing.
private struct RechargePlate: View {
    let title: String
    let readyText: String

    var body: some View {
        HStack {
            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
                .lineLimit(1)
            Spacer()
            Text(readyText)
                .font(.caption)
                .fontWeight(.semibold)
                .monospacedDigit()
                .lineLimit(1)
                .fixedSize()
        }
        .foregroundStyle(Color("AppSecondaryText"))
        .padding(.vertical, 15)
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 22)
                .fill(Color("AppSecondaryText").opacity(0.08))
        )
    }
}

/// The third, rarer action: a small content-hugging pill in the warm
/// AppPrimary wash — the onboarding selected-pill recipe (wash fill,
/// AppPrimaryText label so the small text stays readable), visibly
/// tappable but still subordinate to the two daily actions above it.
private struct TuneProfileButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: "gearshape")
                Text("Tune your profile")
            }
            .font(.footnote)
            .fontWeight(.medium)
            .foregroundStyle(Color("AppPrimaryText"))
            .padding(.horizontal, 16)
            .padding(.vertical, 9)
            .background(
                Capsule().fill(Color("AppPrimary").opacity(0.22))
            )
        }
        .buttonStyle(PressableButtonStyle())
    }
}

private struct SwipeCue: View {
    let text: String

    var body: some View {
        VStack(spacing: 10) {
            Text(text)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(Color("AppPrimaryText"))

            Image(systemName: "arrow.left")
                .font(.title3)
                .fontWeight(.semibold)
                .foregroundStyle(Color("AppPrimary"))
                .phaseAnimator([false, true]) { view, phase in
                    view
                        .offset(x: phase ? -9 : 5)
                        .opacity(phase ? 1 : 0.45)
                } animation: { _ in
                    .easeInOut(duration: 1.1)
                }
        }
    }
}
