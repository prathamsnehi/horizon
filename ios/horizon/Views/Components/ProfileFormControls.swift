//
//  ProfileFormControls.swift
//  horizon
//
//  Form pieces shared by the questionnaire and the Settings editor: the
//  how-far dial, and the display names for the preset-only profile enums.
//

import SwiftUI

/// The 1–5 "How Far" dial: how far past the edge a quest may push. Its
/// captions deliberately speak the same language the quest cards do
/// (Within → Far beyond), so what you set here is what you read back on
/// every card.
///
/// Carries no label of its own — both call sites (the questionnaire's
/// step 02, Settings' section 02) already head it "How Far", and it used
/// to say so a second time directly underneath.
struct ComfortZoneDial: View {
    @Binding var level: Int

    private static let captions = [
        1: "Right at the edge of comfortable",
        2: "A step out",
        3: "A real stretch",
        4: "Well beyond",
        5: "Far beyond — surprise me"
    ]

    /// What the setting actually buys you, in the terms the quest will
    /// be felt in — the caption alone never made that clear.
    private static let details = [
        1: "A nudge. You'll recognise most of it.",
        2: "Slightly unfamiliar, never alarming.",
        3: "Enough to make you pause, not enough to talk you out of it.",
        4: "You'll need a minute before you go in.",
        5: "Assume the nerves. Go anyway."
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Slider(
                value: Binding(
                    get: { Double(level) },
                    set: { level = Int($0.rounded()) }
                ),
                in: 1...5,
                step: 1
            )
            .tint(Color("AppPrimary"))
            .sensoryFeedback(.impact(weight: .light, intensity: 0.5), trigger: level)

            VStack(alignment: .leading, spacing: 4) {
                Text(Self.captions[level] ?? "")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(Color("AppPrimary"))

                Text(Self.details[level] ?? "")
                    .font(.footnote)
                    .foregroundStyle(Color("AppSecondaryText"))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .contentTransition(.opacity)
            .animation(.easeInOut(duration: 0.15), value: level)
        }
    }
}

// MARK: - Display names for preset-only enums

extension BudgetLevel: PillDisplayable {
    var displayName: String {
        switch self {
        case .free: "Free"
        case .cheap: "Cheap"
        case .moderate: "Moderate"
        case .splurge: "Splurge"
        }
    }
}

extension TransportationMode: PillDisplayable {
    var displayName: String {
        switch self {
        case .walking: "Walking"
        case .publicTransport: "Public transport"
        case .car: "Car"
        case .bike: "Bike"
        case .rideshare: "Rideshare"
        }
    }
}

extension LocationPreference: PillDisplayable {
    var displayName: String {
        switch self {
        case .downtown: "Downtown"
        case .neighborhood: "Neighborhood"
        case .nature: "Nature"
        case .indoors: "Indoors"
        case .waterfront: "Waterfront"
        case .anywhere: "Anywhere"
        }
    }
}
