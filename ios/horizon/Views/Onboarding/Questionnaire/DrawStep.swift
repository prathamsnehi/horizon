//
//  DrawStep.swift
//  horizon
//
//  Questionnaire step 03: interests and vibes, both free-form. Interests are
//  asked in both tenses — the hint has to say so, and Settings repeats it.
//

import SwiftUI

struct DrawStep: View {
    @Bindable var model: OnboardingFlowScreenModel

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            StepHeader(
                number: "03",
                eyebrow: "The Draw",
                title: "What pulls you in?",
                subtitle: "Your interests, and the vibe you want your quests to carry."
            )
            .revealOnAppear()

            ProfilePillField(
                label: "Interests",
                hint: "Things you love, or want to get into.",
                presets: ProfileVocabulary.interests,
                selected: model.interests,
                placeholder: "Add your own…",
                onToggle: { model.toggleInterest($0) },
                onAdd: { model.addCustomInterest($0) }
            )
            .revealOnAppear(delay: 0.12)

            ProfilePillField(
                label: "Vibe",
                presets: ProfileVocabulary.vibes,
                selected: model.vibes,
                placeholder: "Add your own…",
                onToggle: { model.toggleVibe($0) },
                onAdd: { model.addCustomVibe($0) }
            )
            .revealOnAppear(delay: 0.24)
        }
    }
}

#Preview("03 · The Draw") {
    @Previewable @State var model = OnboardingFlowScreenModel()
    ZStack {
        AmbientBackground()
        ScrollView(showsIndicators: false) {
            DrawStep(model: model)
                .padding(.horizontal, 28)
                .padding(.vertical, 32)
        }
    }
}

/// With customs added, which is the case worth eyeballing — user-added
/// pills sit alongside the presets and can be longer than any of them.
#Preview("03 · The Draw (customs)") {
    @Previewable @State var model: OnboardingFlowScreenModel = {
        let model = OnboardingFlowScreenModel()
        model.interests = ["Coffee shops", "Live music", "Vintage record shops"]
        model.vibes = ["Solo", "Spontaneous", "Rainy day energy"]
        return model
    }()
    ZStack {
        AmbientBackground()
        ScrollView(showsIndicators: false) {
            DrawStep(model: model)
                .padding(.horizontal, 28)
                .padding(.vertical, 32)
        }
    }
}
