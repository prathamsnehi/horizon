//
//  ProfileDraft.swift
//  horizon
//
//  The profile fields as an editable draft plus the rules that go with
//  them — shared by onboarding and Settings so the two can't diverge.
//

import Foundation

@MainActor
protocol ProfileDraft: AnyObject {
    var comfortZoneEdges: [String] { get set }
    var interests: [String] { get set }
    var vibes: [String] { get set }
    var experimentationLevel: Int { get set }
    var budget: [BudgetLevel] { get set }
    var transportation: [TransportationMode] { get set }
    var locationPreferences: [LocationPreference] { get set }
    var selectedCity: SelectedCity? { get set }
    var additionalContext: String { get set }
}

// MARK: - Selection toggles

extension ProfileDraft {
    func toggleComfortZoneEdge(_ value: String) { toggle(value, in: &comfortZoneEdges) }
    func toggleInterest(_ value: String) { toggle(value, in: &interests) }
    func toggleVibe(_ value: String) { toggle(value, in: &vibes) }
    func toggleBudget(_ value: BudgetLevel) { toggle(value, in: &budget) }
    func toggleTransportation(_ value: TransportationMode) { toggle(value, in: &transportation) }

    /// "Anywhere" is mutually exclusive: picking it clears the rest (an
    /// all-of-the-above selection biases the LLM against it), and
    /// picking anything specific removes "anywhere".
    func toggleLocationPreference(_ value: LocationPreference) {
        if locationPreferences.contains(value) {
            locationPreferences.removeAll { $0 == value }
        } else if value == .anywhere {
            locationPreferences = [.anywhere]
        } else {
            locationPreferences.removeAll { $0 == .anywhere }
            locationPreferences.append(value)
        }
    }

    private func toggle<T: Equatable>(_ value: T, in list: inout [T]) {
        if let index = list.firstIndex(of: value) {
            list.remove(at: index)
        } else {
            list.append(value)
        }
    }
}

// MARK: - Custom pills

extension ProfileDraft {
    /// Swiping right on an edge card and typing a custom one both land
    /// here — the same trim/dedupe rules either way.
    func addComfortZoneEdge(_ raw: String) { addCustom(raw, to: &comfortZoneEdges) }
    func addCustomInterest(_ raw: String) { addCustom(raw, to: &interests) }
    func addCustomVibe(_ raw: String) { addCustom(raw, to: &vibes) }

    /// Trimmed and case-insensitively deduplicated; arrives selected.
    private func addCustom(_ raw: String, to list: inout [String]) {
        let value = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty, value.count <= ValidationLimits.profileStringChars else { return }
        guard list.count < ValidationLimits.profileArrayItems else { return }
        guard !list.contains(where: { $0.caseInsensitiveCompare(value) == .orderedSame }) else { return }
        list.append(value)
    }
}

// MARK: - Validity + save

extension ProfileDraft {
    /// Every required field answered. Onboarding checks its steps one at
    /// a time; this is their union, and Settings' Save gate.
    var isComplete: Bool {
        !comfortZoneEdges.isEmpty
            && !interests.isEmpty
            && !vibes.isEmpty
            && !budget.isEmpty
            && !transportation.isEmpty
            && !locationPreferences.isEmpty
            && selectedCity != nil
    }

    /// Writes the draft onto a profile. Leaves quests and the
    /// daily-limit stamps alone, so the next generation simply builds
    /// its payload from the updated answers.
    func apply(to profile: UserProfile) {
        guard let selectedCity else { return }

        profile.comfortZoneEdges = comfortZoneEdges
        profile.interests = interests
        profile.vibes = vibes
        profile.experimentationLevel = experimentationLevel
        profile.budget = budget
        profile.transportation = transportation
        profile.locationPreferences = locationPreferences
        profile.city = selectedCity.name
        profile.cityLatitude = selectedCity.latitude
        profile.cityLongitude = selectedCity.longitude
        let trimmed = additionalContext.trimmingCharacters(in: .whitespacesAndNewlines)
        profile.additionalContext = trimmed.isEmpty ? nil : trimmed
        profile.updatedAt = .now
    }
}
