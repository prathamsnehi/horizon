//
//  SettingsScreenModel.swift
//  horizon
//
//  The draft behind the Settings profile editor: loads the UserProfile,
//  holds editable copies of its fields, writes them back on Save.
//

import Foundation
import UIKit

@Observable
@MainActor
final class SettingsScreenModel: ProfileDraft {

    var comfortZoneEdges: [String]
    var interests: [String]
    var vibes: [String]
    var experimentationLevel: Int
    var budget: [BudgetLevel]
    var transportation: [TransportationMode]
    var locationPreferences: [LocationPreference]
    var selectedCity: SelectedCity?
    var additionalContext: String

    init(profile: UserProfile) {
        comfortZoneEdges = profile.comfortZoneEdges
        interests = profile.interests
        vibes = profile.vibes
        experimentationLevel = profile.experimentationLevel
        budget = profile.budget
        transportation = profile.transportation
        locationPreferences = profile.locationPreferences
        additionalContext = profile.additionalContext ?? ""

        // Rebuild the picked city only when exact coords exist — a
        // profile without them forces a fresh pick before saving.
        if let latitude = profile.cityLatitude,
           let longitude = profile.cityLongitude,
           !profile.city.isEmpty {
            selectedCity = SelectedCity(name: profile.city, latitude: latitude, longitude: longitude)
        } else {
            selectedCity = nil
        }
    }

    var canSave: Bool { isComplete }

    func save(to profile: UserProfile) {
        guard canSave else { return }
        apply(to: profile)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}
