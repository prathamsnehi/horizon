//
//  EdgeDeckSection.swift
//  horizon
//
//  The question the whole app rests on: nine comfort-zone edges, swipe right
//  on the ones that make you hesitate. No hint — Skip takes that row.
//

import SwiftUI
import UIKit

struct EdgeDeckSection: View {
    @Bindable var model: OnboardingFlowScreenModel
    /// Fires once the last card is swiped away.
    let onFinished: () -> Void

    /// Skipping is only useful once there's something to skip *with* —
    /// EdgeStep won't advance on an empty list either.
    private var canSkip: Bool { !model.comfortZoneEdges.isEmpty }

    var body: some View {
        ZStack {
            BreathingGlow()

            VStack(spacing: 18) {
                SwipeDeck(
                    items: ComfortZoneEdge.presets,
                    onFinished: onFinished,
                    // Both directions are valid here, and mean opposite things.
                    onSwipe: { edge, direction in
                        if direction == .right {
                            UINotificationFeedbackGenerator().notificationOccurred(.success)
                            model.addComfortZoneEdge(edge.label)
                        } else {
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        }
                        return true
                    }
                ) { card in
                    EdgeCardFace(
                        edge: card.item,
                        position: card.index + 1,
                        total: ComfortZoneEdge.presets.count,
                        onPass: { card.swipe(.left) },
                        onCommit: { card.swipe(.right) }
                    )
                }

                skipButton
            }
            .padding(.horizontal, 24)
            // The deck rides higher than the other two so the button
            // below it isn't crowding the home indicator — but only
            // slightly; the safe-area inset already sits beneath this.
            .padding(.top, 16)
            .padding(.bottom, 12)
        }
    }

    /// Deliberately **not** `.liquidGlass`, and styled per-layer rather
    /// than behind a blanket `.opacity` — a uniformly faded capsule reads
    /// as broken rather than inert.
    private var skipButton: some View {
        Button(action: onFinished) {
            Text("Skip")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(
                    canSkip ? Color("AppPrimaryText") : Color("AppSecondaryText").opacity(0.5)
                )
                .padding(.horizontal, 18)
                .padding(.vertical, 10)
                .background(Color("AppSurface").opacity(canSkip ? 1 : 0.4), in: Capsule())
                .overlay(
                    Capsule().strokeBorder(
                        Color("AppSecondaryText").opacity(canSkip ? 0.2 : 0.08),
                        lineWidth: 0.5
                    )
                )
                .contentShape(Capsule())
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(!canSkip)
        .animation(.easeInOut(duration: 0.25), value: canSkip)
    }
}

/// As it opens — nothing picked yet, so Skip is dimmed and inert.
#Preview("Edge deck") {
    @Previewable @State var model = OnboardingFlowScreenModel()
    EdgeDeckSection(model: model, onFinished: {})
}

/// Mid-deck, one edge already swiped right: Skip is live.
#Preview("Edge deck · skip enabled") {
    @Previewable @State var model: OnboardingFlowScreenModel = {
        let model = OnboardingFlowScreenModel()
        model.addComfortZoneEdge(ComfortZoneEdge.presets[0].label)
        return model
    }()
    EdgeDeckSection(model: model, onFinished: {})
}
