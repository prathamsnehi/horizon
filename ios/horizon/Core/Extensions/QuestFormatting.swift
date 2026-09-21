//
//  QuestFormatting.swift
//  horizon
//
//  Display formatting shared across quest views.
//

import SwiftUI

extension Quest {
    /// "45 min", "1 hr", "1 hr 30 min"
    var formattedActivityTime: String {
        if estimatedActivityMinutes < 60 {
            return "\(estimatedActivityMinutes) min"
        }
        let hours = estimatedActivityMinutes / 60
        let remainder = estimatedActivityMinutes % 60
        return remainder == 0 ? "\(hours) hr" : "\(hours) hr \(remainder) min"
    }

    /// "Jun 12, 2026" — timeline / log date label, nil when not completed.
    var completedDateLabel: String? {
        completedAt?.formatted(.dateTime.month(.abbreviated).day().year())
    }

    /// "Accepted today" / "Accepted yesterday" / "Accepted N days ago", nil when never accepted.
    var acceptedAgoText: String? {
        guard let acceptedAt else { return nil }
        let days = Calendar.current.dateComponents(
            [.day],
            from: Calendar.current.startOfDay(for: acceptedAt),
            to: Calendar.current.startOfDay(for: .now)
        ).day ?? 0

        switch days {
        case 0: return "Accepted today"
        case 1: return "Accepted yesterday"
        default: return "Accepted \(days) days ago"
        }
    }
}

extension LocationInformation {
    /// "2.4 mi", nil when the backend sent no distance.
    var formattedDistanceMiles: String? {
        distanceMiles.map { String(format: "%.1f mi", $0) }
    }
}

extension TransportationMode {
    var systemIconName: String {
        switch self {
        case .walking: "figure.walk"
        case .publicTransport: "bus.fill"
        case .car: "car.fill"
        case .bike: "bicycle"
        case .rideshare: "car.front.waves.up"
        }
    }
}

extension DifficultyRating {
    /// The user-facing scale is distance from the comfort zone (shown
    /// under a "Comfort zone" label) — the wire values (easy…extreme)
    /// are backend plumbing and never surface in UI.
    var displayName: String {
        switch self {
        case .easy: "Within"
        case .moderate: "A step out"
        case .hard: "Well beyond"
        case .extreme: "Far beyond"
        }
    }

    var displayColor: Color {
        switch self {
        case .easy: .green
        case .moderate: .orange
        case .hard: .red
        case .extreme: .purple
        }
    }
}
