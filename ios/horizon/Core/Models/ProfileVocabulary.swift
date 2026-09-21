//
//  ProfileVocabulary.swift
//  horizon
//
//  Everything the app offers the user to pick from: the preset profile
//  pills, and the edge catalogue the onboarding deck presents.
//

import Foundation

enum ProfileVocabulary {
    /// Derived from the deck's catalogue so the two can't drift.
    static let comfortZoneEdges = ComfortZoneEdge.presets.map(\.label)

    static let interests = [
        "Coffee shops", "Photography", "Live music", "Nature", "Trying new foods",
        "Art & museums", "Books", "Fitness", "Local history", "Nightlife"
    ]

    static let vibes = [
        "Solo", "Social", "Chill", "Adventurous", "Creative",
        "Spontaneous", "Chaotic", "Night owl", "Romantic", "Quirky"
    ]

    /// Presets plus any selected customs that aren't presets — what a
    /// pill grid should display.
    static func pillOptions(presets: [String], selected: [String]) -> [String] {
        presets + selected.filter { value in
            !presets.contains { $0.caseInsensitiveCompare(value) == .orderedSame }
        }
    }
}

// MARK: - The edge catalogue

/// One comfort-zone edge as the onboarding deck presents it. Two rules
/// for authoring these: each has to become a real place you go and a
/// thing you do there, and each `subline` has to name **the moment of
/// friction**, never the reward — a subline that sells the activity
/// collects right-swipes from people who enjoy the thing, storing the
/// inverse of what the field means (see ios/docs/product.md).
///
/// `label` is the only part persisted or sent; the rest is presentation,
/// kept alongside it so a reordering can't hand a card someone else's line.
struct ComfortZoneEdge: Identifiable {
    let label: String
    let subline: String
    /// Imageset name. A miss falls back to a bundled sample photo.
    let photo: String
    /// Unsplash handle, without the @. Empty hides the credit tag.
    let photoCredit: String

    var id: String { label }

    static let presets: [ComfortZoneEdge] = [
        ComfortZoneEdge(
            label: "Talking to strangers",
            subline: "The pause before you say hi.",
            photo: "talk-strangers",
            photoCredit: "harlimarten"
        ),
        ComfortZoneEdge(
            label: "Eating out alone",
            subline: "A table for one, and no phone to hide in.",
            photo: "eating-alone",
            photoCredit: "tuan1561"
        ),
        ComfortZoneEdge(
            label: "Going to events solo",
            subline: "Walking in alone, with nobody to stand next to.",
            photo: "events-solo",
            photoCredit: "rawminh"
        ),
        ComfortZoneEdge(
            label: "Being bad at something new",
            subline: "Being visibly bad at it, in front of people.",
            photo: "beginner",
            photoCredit: "adspedia"
        ),
        ComfortZoneEdge(
            label: "Joining a group where I know no one",
            subline: "Every conversation already in progress.",
            photo: "join-group",
            photoCredit: "bonjour__val"
        ),
        ComfortZoneEdge(
            label: "Exploring unfamiliar parts of town",
            subline: "Not knowing which way is back.",
            photo: "unfamiliar-town",
            photoCredit: "diegosmarines"
        ),
        ComfortZoneEdge(
            label: "Going out with no plan",
            subline: "No reservation, no backup, no idea.",
            photo: "no-plan",
            photoCredit: "miketenfotografia"
        ),
        ComfortZoneEdge(
            label: "Trying unfamiliar food",
            subline: "Whatever arrives, you're eating it.",
            photo: "unfamiliar-food",
            photoCredit: "cranky.bear"
        ),
        ComfortZoneEdge(
            label: "Physical discomfort",
            subline: "Cold water, high places, long distances.",
            photo: "physical-discomfort",
            photoCredit: "kev.wolf"
        )
    ]
}
