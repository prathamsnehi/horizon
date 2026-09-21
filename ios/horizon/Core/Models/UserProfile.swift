//
//  UserProfile.swift
//  horizon
//
//  Created by Pratham S on 6/18/26.
//

import Foundation
import SwiftData

// CloudKit mirroring note: every stored property carries an inline
// default (or is optional) — a hard requirement of SwiftData's
// CloudKit-backed stores.
@Model
class UserProfile {
    // The dedupe tiebreak when CloudKit merges in a second profile.
    var updatedAt: Date = Date()

    // Results from onboarding. The three free-form fields hold preset
    // labels (ProfileVocabulary) plus the user's own additions.
    var interests: [String] = []
    var comfortZoneEdges: [String] = []
    var vibes: [String] = []
    var experimentationLevel: Int = 1 // 1-5 dial, how far past the edge
    var budget: [BudgetLevel] = []
    var transportation: [TransportationMode] = []
    var locationPreferences: [LocationPreference] = []
    var additionalContext: String?

    // Location:
    var city: String = ""
    // LatLong help in calculating distances to quest
    // locations (contributes to determine difficulty)
    var cityLatitude: Double?
    var cityLongitude: Double?

    // Daily generation limits — each action usable once per rolling 24h
    // window (see GenerationLimit). Client-side these gate the UI; the
    // backend is the real enforcer, keyed on the auth uid.
    var lastCuratedGenerationDate: Date?
    var lastDescribedGenerationDate: Date?

    // Note: whether onboarding is complete is a simple @AppStorage flag
    // ("hasCompletedOnboarding", read by horizonApp) — not persisted
    // here, so the launch gate never has to wait on a SwiftData query.

    init() {}
}

// MARK: - Preset-only profile fields

/// A profile enum whose full case list is the pill grid — rendered and
/// toggled as values, never round-tripped through `displayName`.
/// Conformances sit with the display names, in `ProfileFormControls`.
protocol PillDisplayable: CaseIterable, Hashable {
    var displayName: String { get }
}

enum BudgetLevel: String, Codable, CaseIterable {
    case free, cheap, moderate, splurge
}

enum TransportationMode: String, Codable, CaseIterable {
    case walking, publicTransport, car, bike, rideshare
}

enum LocationPreference: String, Codable, CaseIterable {
    case downtown, neighborhood, nature, indoors, waterfront, anywhere
}
