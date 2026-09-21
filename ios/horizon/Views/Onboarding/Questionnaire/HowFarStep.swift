//
//  HowFarStep.swift
//  horizon
//
//  Questionnaire step 02: having named the edges, how hard should a quest
//  push against them. One dial, with room to say what each setting feels like.
//

import SwiftUI

struct HowFarStep: View {
    @Bindable var model: OnboardingFlowScreenModel

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            StepHeader(
                number: "02",
                eyebrow: "How Far",
                title: "How hard should we push?",
                subtitle: "You told us what you avoid. This sets how far past it a quest is allowed to take you."
            )
            .revealOnAppear()

            ComfortZoneDial(level: $model.experimentationLevel)
                .revealOnAppear(delay: 0.12)
        }
    }
}

#Preview("02 · How Far") {
    @Previewable @State var model = OnboardingFlowScreenModel()
    ZStack {
        AmbientBackground()
        ScrollView(showsIndicators: false) {
            HowFarStep(model: model)
                .padding(.horizontal, 28)
                .padding(.vertical, 32)
        }
    }
}

/// Both ends of the dial, where the copy has to carry the most weight.
#Preview("02 · How Far (far beyond)") {
    @Previewable @State var model: OnboardingFlowScreenModel = {
        let model = OnboardingFlowScreenModel()
        model.experimentationLevel = 5
        return model
    }()
    ZStack {
        AmbientBackground()
        ScrollView(showsIndicators: false) {
            HowFarStep(model: model)
                .padding(.horizontal, 28)
                .padding(.vertical, 32)
        }
    }
}
