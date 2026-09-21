//
//  BreathingGlow.swift
//  horizon
//
//  The backdrop for onboarding's two full-screen decks — the resonance
//  overture and the edge deck.
//

import SwiftUI

/// AmbientBackground with one extra glow that slowly breathes —
/// continuous motion, so it lives comfortably within the motion rules.
struct BreathingGlow: View {
    var body: some View {
        ZStack {
            AmbientBackground()

            TimelineView(.animation(minimumInterval: 1 / 30)) { context in
                let t = context.date.timeIntervalSinceReferenceDate
                let phase = (sin(t * 0.6) + 1) / 2 // 0…1, ~10s cycle

                RadialGradient(
                    colors: [Color("AppPrimary").opacity(0.10 + 0.06 * phase), .clear],
                    center: .topTrailing,
                    startRadius: 0,
                    endRadius: 420 + 60 * phase
                )
                .ignoresSafeArea()
            }
            .allowsHitTesting(false)
        }
    }
}
