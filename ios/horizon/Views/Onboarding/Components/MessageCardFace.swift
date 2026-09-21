//
//  MessageCardFace.swift
//  horizon
//
//  Editorial copy on a card: resonance beats and walkthrough lessons. No
//  button anywhere — the swipe named by the hint moves every card on.
//

import SwiftUI

struct MessageCardFace: View {
    /// The visual above the copy. Stays an enum rather than a view
    /// parameter: `ResonanceSymbol` is generic over its symbol effect,
    /// so the effect can't ride along without type erasure.
    enum Demo {
        // Walkthrough
        case dailyActions
        // Resonance vignettes
        case comfortZone, questMap, curatedDeck, horizonSunrise
    }

    let eyebrow: String
    let headline: String
    let subline: String
    let demo: Demo
    let isTopCard: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Spacer()

            visual.frame(maxWidth: .infinity)

            Eyebrow(text: eyebrow, color: Color("AppPrimary"))
                .padding(.top, 10)

            Text(headline)
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundStyle(Color("AppPrimaryText"))
                .lineSpacing(4)

            Text(subline)
                .font(.body)
                .foregroundStyle(Color("AppSecondaryText"))
                .lineSpacing(5)

            Spacer()
        }
        .padding(28)
    }

    @ViewBuilder
    private var visual: some View {
        switch demo {
        case .dailyActions:
            DailyActionsDemo(isRevealed: isTopCard)
        case .comfortZone:
            ResonanceSymbol(systemName: "figure.walk.departure", isRevealed: isTopCard, effect: .wiggle)
        case .questMap:
            ResonanceSymbol(systemName: "map.fill", isRevealed: isTopCard, effect: .bounce)
        case .curatedDeck:
            ResonanceSymbol(
                systemName: "rectangle.portrait.on.rectangle.portrait.angled.fill",
                isRevealed: isTopCard,
                effect: .wiggle
            )
        case .horizonSunrise:
            ResonanceSymbol(systemName: "sun.horizon.fill", isRevealed: isTopCard, effect: .bounce)
        }
    }
}

// Faces render inside the deck's card shell, so the preview supplies the
// same one — otherwise the padding and the symbol's proportions read wrong.
#Preview("Message card") {
    ZStack {
        AmbientBackground()
        MessageCardFace(
            eyebrow: "Meet Horizon",
            headline: "Real-world quests, made for you.",
            subline: "Small, doable adventures at real places near you — crafted around what you love and where you want to grow.",
            demo: .questMap,
            isTopCard: true
        )
        .frame(height: 560)
        .background(
            RoundedRectangle(cornerRadius: 32)
                .fill(Color("AppSurface"))
                .shadow(color: .black.opacity(0.16), radius: 22, y: 14)
        )
        .padding(.horizontal, 28)
    }
}
