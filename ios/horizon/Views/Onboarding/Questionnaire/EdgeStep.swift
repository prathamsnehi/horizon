//
//  EdgeStep.swift
//  horizon
//
//  Questionnaire step 01: what the edge deck produced, laid out to be
//  amended. Every preset shows, so a mis-swipe is one tap from fixed.
//

import SwiftUI

struct EdgeStep: View {
    @Bindable var model: OnboardingFlowScreenModel

    private var title: String {
        model.comfortZoneEdges.isEmpty
            ? "Nothing yet."
            : "You picked \(model.comfortZoneEdges.count)."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            StepHeader(
                number: "01",
                eyebrow: "The Edge",
                title: title,
                subtitle: "Tap to add or remove — everything you swiped through is here. This is what your quests get built to push against."
            )
            .revealOnAppear()

            ProfilePillField(
                presets: ProfileVocabulary.comfortZoneEdges,
                selected: model.comfortZoneEdges,
                placeholder: "Anything we missed?",
                onToggle: { model.toggleComfortZoneEdge($0) },
                onAdd: { model.addComfortZoneEdge($0) }
            )
            .revealOnAppear(delay: 0.12)
        }
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: model.comfortZoneEdges)
    }
}

#Preview("01 · The Edge") {
    @Previewable @State var model: OnboardingFlowScreenModel = {
        let model = OnboardingFlowScreenModel()
        model.comfortZoneEdges = ["Talking to strangers", "Eating out alone", "Going out with no plan"]
        return model
    }()
    ZStack {
        AmbientBackground()
        ScrollView(showsIndicators: false) {
            EdgeStep(model: model)
                .padding(.horizontal, 28)
                .padding(.vertical, 32)
        }
    }
}

/// Swiped left on all ten — the state that leaves Next disabled, and the
/// one the old in-deck review could never show.
#Preview("01 · The Edge (nothing picked)") {
    @Previewable @State var model = OnboardingFlowScreenModel()
    ZStack {
        AmbientBackground()
        ScrollView(showsIndicators: false) {
            EdgeStep(model: model)
                .padding(.horizontal, 28)
                .padding(.vertical, 32)
        }
    }
}

/// With a custom added, which sits alongside the presets and can be
/// longer than any of them.
#Preview("01 · The Edge (custom)") {
    @Previewable @State var model: OnboardingFlowScreenModel = {
        let model = OnboardingFlowScreenModel()
        model.comfortZoneEdges = ["Being bad at something new", "Speaking up in a room full of people I don't know"]
        return model
    }()
    ZStack {
        AmbientBackground()
        ScrollView(showsIndicators: false) {
            EdgeStep(model: model)
                .padding(.horizontal, 28)
                .padding(.vertical, 32)
        }
    }
}
