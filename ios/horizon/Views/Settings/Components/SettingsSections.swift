//
//  SettingsSections.swift
//  horizon
//
//  The Settings editor's five sections: the questionnaire recomposed as one
//  scroll, under its names, so a field is never described two ways.
//

import SwiftUI

// MARK: - 01 · The Edge

struct EdgeSection: View {
    @Bindable var model: SettingsScreenModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SettingsSectionHeader(number: "01", title: "The Edge")

            // A pill grid rather than onboarding's swipe deck — a deck
            // inside a settings sheet would be a chore to re-run.
            ProfilePillField(
                presets: ProfileVocabulary.comfortZoneEdges,
                selected: model.comfortZoneEdges,
                placeholder: "Add your own…",
                onToggle: { model.toggleComfortZoneEdge($0) },
                onAdd: { model.addComfortZoneEdge($0) }
            )
        }
    }
}

// MARK: - 02 · How Far

struct HowFarSection: View {
    @Bindable var model: SettingsScreenModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SettingsSectionHeader(number: "02", title: "How Far")

            ComfortZoneDial(level: $model.experimentationLevel)
        }
    }
}

// MARK: - 03 · The Draw

struct DrawSection: View {
    @Bindable var model: SettingsScreenModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SettingsSectionHeader(number: "03", title: "The Draw")

            ProfilePillField(
                label: "Interests",
                hint: "Things you love, or want to get into.",
                presets: ProfileVocabulary.interests,
                selected: model.interests,
                placeholder: "Add your own…",
                onToggle: { model.toggleInterest($0) },
                onAdd: { model.addCustomInterest($0) }
            )

            ProfilePillField(
                label: "Vibe",
                presets: ProfileVocabulary.vibes,
                selected: model.vibes,
                placeholder: "Add your own…",
                onToggle: { model.toggleVibe($0) },
                onAdd: { model.addCustomVibe($0) }
            )
        }
    }
}

// MARK: - 04 · The Ground

struct GroundSection: View {
    @Bindable var model: SettingsScreenModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SettingsSectionHeader(number: "04", title: "The Ground")

            VStack(alignment: .leading, spacing: 12) {
                MicroLabel(text: "City")
                CityPickerMap(selectedCity: $model.selectedCity)
            }

            EnumPillField(
                label: "Budget",
                selected: model.budget,
                onToggle: { model.toggleBudget($0) }
            )

            EnumPillField(
                label: "Transportation",
                selected: model.transportation,
                onToggle: { model.toggleTransportation($0) }
            )

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
        }
    }
}

// MARK: - 05 · The Details

struct DetailsSection: View {
    @Bindable var model: SettingsScreenModel

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            SettingsSectionHeader(number: "05", title: "The Details")

            TextField(
                "Constraints, quirks, anything that sharpens the curation…",
                text: $model.additionalContext,
                axis: .vertical
            )
            .font(.body)
            .foregroundStyle(Color("AppPrimaryText"))
            .lineLimit(4...8)
            .padding(16)
            .background(Color("AppSurface"), in: RoundedRectangle(cornerRadius: 16))
            .characterLimit(ValidationLimits.additionalContextChars, $model.additionalContext)

            CharacterCounter(count: model.additionalContext.count, limit: ValidationLimits.additionalContextChars)
        }
    }
}

// MARK: - Shared header

/// The compact numbered eyebrow each Settings section opens with —
/// the questionnaire's dossier motif, without the big step title.
private struct SettingsSectionHeader: View {
    let number: String
    let title: String

    var body: some View {
        Eyebrow(text: title, color: Color("AppSecondaryText"), number: number)
    }
}
