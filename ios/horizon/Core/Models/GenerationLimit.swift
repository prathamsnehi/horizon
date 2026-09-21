//
//  GenerationLimit.swift
//  horizon
//
//  Client-side view of the 24h rolling window for a daily action. UX
//  gating only — the backend is the real gate; this mirrors it.
//

import Foundation

enum GenerationLimit {
    /// The rolling window length.Manually Keep in sync with the backend.
    static let window: TimeInterval = 24 * 60 * 60

    /// When the action recharges, or `nil` if it's ready now — never
    /// used, or the window has fully elapsed.
    static func readyDate(since last: Date?, now: Date = .now) -> Date? {
        guard let last else { return nil }
        let ready = last.addingTimeInterval(window)
        return ready > now ? ready : nil
    }
}
