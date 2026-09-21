//
//  StepHeader.swift
//  horizon
//
//  The two pieces the questionnaire's form steps are built from: their
//  editorial header, and the staggered entrance every step uses.
//

import SwiftUI

/// Numbered eyebrow + question headline + supporting line — the
/// editorial header every step opens with.
struct StepHeader: View {
    let number: String
    let eyebrow: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow(text: eyebrow, color: Color("AppSecondaryText"), number: number)

            Text(title)
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundStyle(Color("AppPrimaryText"))

            Text(subtitle)
                .font(.subheadline)
                .foregroundStyle(Color("AppSecondaryText"))
        }
    }
}

// MARK: - Cinematic reveal (onboarding-only exception)

/// One-shot staggered entrance — allowed here as onboarding's declared
/// exception to the no-one-shot-animation rule (like the confetti).
struct RevealOnAppear: ViewModifier {
    let delay: Double

    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown ? 0 : 14)
            .onAppear {
                withAnimation(.easeOut(duration: 0.45).delay(delay)) {
                    shown = true
                }
            }
    }
}

extension View {
    func revealOnAppear(delay: Double = 0) -> some View {
        modifier(RevealOnAppear(delay: delay))
    }
}

#Preview("Step header") {
    ZStack {
        AmbientBackground()
        StepHeader(
            number: "01",
            eyebrow: "The Edge",
            title: "What's just outside your comfort zone?",
            subtitle: "Swipe right on what makes you hesitate — that's where the good stories are."
        )
        .padding(28)
    }
}
