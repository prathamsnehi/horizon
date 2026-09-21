//
//  GroundStep.swift
//  horizon
//
//  Questionnaire step 04: the practical frame — where the user is based and
//  what's realistic day to day. The optional notes field rides here too.
//

import SwiftUI

struct GroundStep: View {
    @Bindable var model: OnboardingFlowScreenModel

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            StepHeader(
                number: "04",
                eyebrow: "The Ground",
                title: "Where does this happen?",
                subtitle: "Your city, and what's realistic day to day."
            )
            .revealOnAppear()

            VStack(alignment: .leading, spacing: 12) {
                MicroLabel(text: "City")
                CityPickerMap(selectedCity: $model.selectedCity)
            }
            .revealOnAppear(delay: 0.12)

            EnumPillField(
                label: "Budget",
                selected: model.budget,
                onToggle: { model.toggleBudget($0) }
            )
            .revealOnAppear(delay: 0.18)

            EnumPillField(
                label: "Transportation",
                selected: model.transportation,
                onToggle: { model.toggleTransportation($0) }
            )
            .revealOnAppear(delay: 0.24)

            EnumPillField(
                label: "Environments",
                selected: model.locationPreferences,
                // "Anywhere" is exclusive — the model clears the others;
                // the pills' isSelected animation shows it.
                onToggle: { value in
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.8)) {
                        model.toggleLocationPreference(value)
                    }
                }
            )
            .revealOnAppear(delay: 0.3)

            // Was its own step; optional, so it rides here rather than
            // costing the user a whole screen.
            VStack(alignment: .leading, spacing: 6) {
                MicroLabel(text: "Anything else? (optional)")
                TextField(
                    "e.g. I'm free mostly on weekends, and I don't drink…",
                    text: $model.additionalContext,
                    axis: .vertical
                )
                .font(.body)
                .foregroundStyle(Color("AppPrimaryText"))
                .lineLimit(3...8)
                .padding(16)
                .background(Color("AppSurface"), in: RoundedRectangle(cornerRadius: 16))
                .characterLimit(ValidationLimits.additionalContextChars, $model.additionalContext)

                CharacterCounter(count: model.additionalContext.count, limit: ValidationLimits.additionalContextChars)
            }
            .revealOnAppear(delay: 0.36)
        }
    }
}

#Preview("04 · The Ground") {
    @Previewable @State var model = OnboardingFlowScreenModel()
    ZStack {
        AmbientBackground()
        ScrollView(showsIndicators: false) {
            GroundStep(model: model)
                .padding(.horizontal, 28)
                .padding(.vertical, 32)
        }
    }
}

/// Fully answered — the state that unlocks Next, including the picked
/// city (which otherwise needs a live MapKit search to reach).
#Preview("04 · The Ground (filled)") {
    @Previewable @State var model: OnboardingFlowScreenModel = {
        let model = OnboardingFlowScreenModel()
        model.budget = [.cheap, .moderate]
        model.transportation = [.walking, .publicTransport]
        model.locationPreferences = [.downtown, .nature]
        model.selectedCity = SelectedCity(name: "St. Paul, MN", latitude: 44.9537, longitude: -93.0900)
        model.additionalContext = "Free mostly on weekends, and I don't drink."
        return model
    }()
    ZStack {
        AmbientBackground()
        ScrollView(showsIndicators: false) {
            GroundStep(model: model)
                .padding(.horizontal, 28)
                .padding(.vertical, 32)
        }
    }
}
