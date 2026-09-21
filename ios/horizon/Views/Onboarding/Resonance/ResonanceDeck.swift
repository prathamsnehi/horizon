//
//  ResonanceDeck.swift
//  horizon
//
//  The onboarding overture: three editorial cards, then a fourth setting up
//  the edge deck. Only that last one takes a RIGHT swipe, rehearsing it.
//

import SwiftUI
import UIKit

struct ResonanceDeck: View {
    let onBegin: () -> Void

    private struct Card: Identifiable {
        let id: Int
        let eyebrow: String
        let headline: String
        let subline: String
        let demo: MessageCardFace.Demo
        let advance: SwipeDirection
        let hint: String
    }

    private static let cards: [Card] = [
        Card(
            id: 0,
            eyebrow: "Meet Horizon",
            headline: "Real-world quests, made for you.",
            subline: "Small, doable adventures at real places near you — crafted around what you love and where you want to grow.",
            demo: .questMap,
            advance: .left,
            hint: "swipe left to continue"
        ),
        Card(
            id: 1,
            eyebrow: "Irresistible adventures",
            headline: "Curated for you.\nChosen by you.",
            subline: "Every day brings a fresh hand of quests. Swipe through them and commit to the one that calls.",
            demo: .curatedDeck,
            advance: .left,
            hint: "swipe left to continue"
        ),
        Card(
            id: 2,
            eyebrow: "Expand Your Horizon",
            headline: "Experience the world fully.",
            subline: "Finished quests become stories — photos and a note in your logbook.",
            demo: .horizonSunrise,
            advance: .left,
            hint: "swipe left to continue"
        ),
        // The handoff. Deliberately short: the mechanic is taught on the
        // edge cards themselves, so this only says why we're asking.
        Card(
            id: 3,
            eyebrow: "First, the edge",
            headline: "What makes you hesitate?",
            subline: "Ten cards, one thing each. Keep the ones that make you pause — they're what your quests get built to push against.",
            demo: .comfortZone,
            advance: .right,
            hint: "swipe right to begin"
        )
    ]

    var body: some View {
        ZStack {
            BreathingGlow()

            SwipeDeck(
                items: Self.cards,
                hint: { SwipeHint.Config(text: $0.hint, direction: $0.advance == .left ? .left : .right) },
                onFinished: onBegin,
                onSwipe: { card, direction in
                    guard direction == card.advance else { return false }
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    return true
                }
            ) { card in
                MessageCardFace(
                    eyebrow: card.item.eyebrow,
                    headline: card.item.headline,
                    subline: card.item.subline,
                    demo: card.item.demo,
                    isTopCard: card.isTopCard
                )
            }
            .padding(.horizontal, 24)
            .padding(.top, 32)
            .padding(.bottom, 40)
        }
    }
}

#Preview("Resonance deck") {
    ResonanceDeck(onBegin: {})
}
