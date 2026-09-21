//
//  OnboardingFlowScreen.swift
//  horizon
//
//  router for different onboarding sections:
//  Resonance → Edge → Questionnaire → Walkthrough.

import SwiftUI
import SwiftData

struct OnboardingFlowScreen: View {
    /// Fires when the user taps Start at the end of the walkthrough.
    let onFinished: () -> Void

    @Environment(\.modelContext) private var modelContext
    @State private var model = OnboardingFlowScreenModel()
    @State private var phase: Phase = .resonance

    private enum Phase {
        case resonance, edgeDeck, questionnaire, walkthrough
    }

    var body: some View {
        ZStack {
            AmbientBackground()

            switch phase {
            case .resonance:
                ResonanceDeck(onBegin: { advance(to: .edgeDeck) })
                    .transition(.opacity)

            case .edgeDeck:
                EdgeDeckSection(model: model, onFinished: { advance(to: .questionnaire) })
                    .transition(.opacity)

            case .questionnaire:
                QuestionnaireSection(model: model, onFinished: finishQuestionnaire)
                    .transition(.opacity)

            case .walkthrough:
                WalkthroughDeck(onStart: onFinished)
                    .transition(.opacity)
            }
        }
    }

    private func advance(to next: Phase) {
        withAnimation(.easeInOut(duration: 0.4)) { phase = next }
    }

    /// Saves the profile and fires the first generation, then hands over
    /// to the walkthrough, which masks the wait.
    private func finishQuestionnaire() {
        model.finish(context: modelContext)
        advance(to: .walkthrough)
    }
}

/// The generation the questionnaire fires needs Firebase, which previews
/// don't configure — it fails silently, exactly as it does offline.
#Preview {
    OnboardingFlowScreen(onFinished: {})
        .modelContainer(PreviewSwiftData.container)
}
