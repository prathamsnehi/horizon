//
//  FirstGenerationLauncher.swift
//  horizon
//
//  The fire-and-forget first curated generation. The walkthrough plays
//  while it runs and never waits on it; on failure nothing is inserted.

import Foundation
import SwiftData
import UIKit

/// Live state of the onboarding-fired first generation, shared so the
/// Explore base card can show the curating progress (instead of the
/// daily actions, which would double-generate) if the user gets
/// through the walkthrough before the set lands.
@Observable
@MainActor
final class FirstGenerationStatus {
    static let shared = FirstGenerationStatus()
    var isRunning = false
    /// The response landed — the progress bar sprints to full.
    var isCompleting = false
    /// Bumped once cards are in the deck, so Explore can reveal the
    /// first one if the user is already sitting on the base card.
    var insertedSetCount = 0
}

@MainActor
enum FirstGenerationLauncher {
    static func fire(profile: UserProfile, context: ModelContext) {
        // Always attempt, even when a restored profile carries a recent
        // stamp — the backend is the real gate.
        Task {
            let status = FirstGenerationStatus.shared
            status.isRunning = true
            defer {
                status.isRunning = false
                status.isCompleting = false
            }

            do {
                // A restored logbook means completed titles worth
                // excluding; empty for a fresh questionnaire finish.
                let allQuests = (try? context.fetch(FetchDescriptor<Quest>())) ?? []
                let completedTitles = allQuests.filter { $0.status == .completed }.map(\.title)

                let payloads = try await CloudFunctionService().generateCuratedQuests(
                    profile: profile,
                    excludeTitles: completedTitles
                )
                guard !payloads.isEmpty else { return }

                // Deliberately NOT Rule 1 — the only path that appends,
                // so iCloud-restored cards survive. The deck sorts
                // newest-first, so the fresh set still leads.
                for payload in payloads {
                    context.insert(payload.makeQuest(origin: .personalized))
                }
                profile.lastCuratedGenerationDate = .now

                // Same sprint-to-full beat as Explore's own generation,
                // for a user already watching the base card's progress.
                status.isCompleting = true
                try? await Task.sleep(for: .milliseconds(500))

                status.insertedSetCount += 1
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            } catch let error as CloudFunctionError {
                // A reinstalling user keeps their uid (keychain), so the
                // window can legitimately still be spent. Sync the local
                // gate to it, same as Explore does.
                if case .rateLimited(let retryAt) = error {
                    profile.lastCuratedGenerationDate =
                        retryAt?.addingTimeInterval(-GenerationLimit.window) ?? .now
                }
            } catch {
                // Silent: the user is never blocked on the first generation.
            }
        }
    }
}
