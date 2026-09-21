//
//  WalkthroughDeck.swift
//  horizon
//
//  Productive waiting, taught by doing: while the first set generates, the
//  user practices the real interface on cards that commit nothing.
//

import SwiftUI
import SwiftData
import UIKit

struct WalkthroughDeck: View {
    /// Fires when the last card is swiped away.
    let onStart: () -> Void

    @State private var pendingCommit: PendingCommit?

    private struct Card: Identifiable {
        enum Content {
            case practice(quest: Quest, position: Int, total: Int)
            case message(eyebrow: String, headline: String, subline: String, demo: MessageCardFace.Demo)
        }

        let id: Int
        let content: Content
        let advance: SwipeDirection
        /// Swiping this card the right way raises the real commit dialog.
        let confirms: Bool
        let hint: String
    }

    /// A commit dialog waiting on the user, and the continuation the
    /// deck is suspended on until they answer.
    private struct PendingCommit: Identifiable {
        let id = UUID()
        let quest: Quest
        let resolve: (Bool) -> Void
    }

    private static let cards: [Card] = [
        Card(
            id: 0,
            content: .practice(quest: PracticeQuest.passCard(), position: 1, total: 2),
            advance: .left,
            confirms: false,
            hint: "swipe left to pass"
        ),
        Card(
            id: 1,
            content: .practice(quest: PracticeQuest.commitCard(), position: 2, total: 2),
            advance: .right,
            confirms: true,
            hint: "now swipe right to commit"
        ),
        Card(
            id: 2,
            content: .message(
                eyebrow: "Two Ways In",
                headline: "Two ways to get quests.",
                subline: "Generate a personalized set, or describe exactly what you're after — each once per day.",
                demo: .dailyActions
            ),
            advance: .left,
            confirms: false,
            hint: "swipe left to start exploring"
        )
    ]

    var body: some View {
        ZStack {
            AmbientBackground()

            VStack(spacing: 0) {
                Eyebrow(text: "How Horizon Works", color: Color("AppPrimary"))
                    .padding(.top, 28)

                SwipeDeck(
                    items: Self.cards,
                    hint: { SwipeHint.Config(text: $0.hint, direction: $0.advance == .left ? .left : .right) },
                    onFinished: onStart,
                    onSwipe: confirmSwipe
                ) { card in
                    face(for: card)
                }
                .padding(.horizontal, 24)
                .padding(.top, 24)
                .padding(.bottom, 32)
            }

            // Presented from the screen's root so the dim scrim covers
            // the full screen, not just the deck's inset frame.
            if let pending = pendingCommit {
                CommitConfirmCard(
                    quest: pending.quest,
                    hasActiveQuest: false,
                    onCommit: { resolve(pending, committed: true) },
                    onCancel: { resolve(pending, committed: false) }
                )
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: pendingCommit != nil)
    }

    @ViewBuilder
    private func face(for card: SwipeDeckCard<Card>) -> some View {
        switch card.item.content {
        case .practice(let quest, let position, let total):
            SwipeQuestCard(
                quest: quest,
                position: position,
                total: total,
                // The card's own ✕/✓ are part of the lesson, so they run
                // through the same gate as the swipe.
                onPass: { card.swipe(.left) },
                onCommit: { card.swipe(.right) }
            )
        case .message(let eyebrow, let headline, let subline, let demo):
            MessageCardFace(
                eyebrow: eyebrow,
                headline: headline,
                subline: subline,
                demo: demo,
                isTopCard: card.isTopCard
            )
        }
    }

    /// The lesson gate: wrong direction is refused, and the commit card
    /// hangs mid-flight until the real dialog is answered.
    private func confirmSwipe(_ card: Card, _ direction: SwipeDirection) async -> Bool {
        guard direction == card.advance else { return false }

        guard card.confirms, case .practice(let quest, _, _) = card.content else {
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            return true
        }

        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        return await withCheckedContinuation { continuation in
            pendingCommit = PendingCommit(quest: quest, resolve: continuation.resume(returning:))
        }
    }

    /// Cleared before resuming, so neither button can resolve twice.
    private func resolve(_ pending: PendingCommit, committed: Bool) {
        pendingCommit = nil
        if committed {
            // Celebrate and move on — nothing is actually committed.
            UINotificationFeedbackGenerator().notificationOccurred(.success)
        }
        pending.resolve(committed)
    }
}

// SwipeQuestCard renders real Quest values, so the preview gets a
// container even though nothing is inserted into it.
#Preview("Walkthrough deck") {
    WalkthroughDeck(onStart: {})
        .modelContainer(PreviewSwiftData.container)
}
