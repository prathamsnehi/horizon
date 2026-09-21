//
//  OnboardingFlowScreenModel.swift
//  horizon
//
//  Draft state, validation, and finish logic for onboarding. Finishing
//  saves the profile and fires the first generation, gating on neither.
//

import Foundation
import SwiftData

@Observable
@MainActor
final class OnboardingFlowScreenModel: ProfileDraft {

    // MARK: Steps

    enum Step: Int, CaseIterable {
        case edge, howFar, draw, ground

        var advanceTitle: String {
            switch self {
            case .ground: "Generate My Quests"
            default: "Next"
            }
        }
    }

    var currentStep: Step = .edge

    /// Whether the current step's required selections are made.
    var canAdvance: Bool {
        switch currentStep {
        case .edge: !comfortZoneEdges.isEmpty
        case .howFar: true // the dial always holds a value
        case .draw: !interests.isEmpty && !vibes.isEmpty
        case .ground:
            !budget.isEmpty
                && !transportation.isEmpty
                && !locationPreferences.isEmpty
                && selectedCity != nil
        }
    }

    // MARK: Draft selections

    var comfortZoneEdges: [String] = []
    var interests: [String] = []
    var vibes: [String] = []
    var experimentationLevel = 3
    var budget: [BudgetLevel] = []
    var transportation: [TransportationMode] = []
    var locationPreferences: [LocationPreference] = []
    var selectedCity: SelectedCity?
    var additionalContext = ""

    // MARK: Finish + first generation

    private var savedProfile: UserProfile?

    /// Saves the profile and fires the first curated generation in the
    /// background — the walkthrough plays while it runs, but never
    /// waits on it.
    ///
    /// Idempotent across interrupted sessions: the profile is saved here
    /// but the hasCompletedOnboarding flag only flips at the walkthrough's
    /// Start — if the app dies in between, onboarding re-runs. So a
    /// re-run REVISES the existing profile instead of inserting a second
    /// one, keeping the singleton invariant.
    func finish(context: ModelContext) {
        guard savedProfile == nil, selectedCity != nil else { return }

        let existing = (try? context.fetch(FetchDescriptor<UserProfile>()))?.first
        let profile = existing ?? UserProfile()
        apply(to: profile)

        if existing == nil {
            context.insert(profile)
        }
        savedProfile = profile

        FirstGenerationLauncher.fire(profile: profile, context: context)
    }
}
