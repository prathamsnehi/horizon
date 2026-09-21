//
//  ExploreScreenModel.swift
//  horizon
//
//  Feed state + generation actions for Explore. The backend enforces the
//  daily limits; a rejection is reconciled into the profile's stamps.
//

import Foundation
import SwiftData
import UIKit

@Observable
@MainActor
final class ExploreScreenModel {
    var isGeneratingSet = false
    
    /// True once the curated response has landed — the progress bar
    /// sprints to full during the brief hold before the reveal.
    var setGenerationCompleting = false
    
    var isDescribing = false
    
    /// True once the described response has landed — same sprint-to-full
    /// hold as the curated set.
    var describeCompleting = false
    
    var errorMessage: String?

    private let service = CloudFunctionService()

    /// Pulls a fresh curated set and applies Rule 1: unaccepted
    /// personalized cards are replaced; described + active are untouched.
    /// Returns true on success so the feed can reveal the first card.
    func generateCuratedSet(profile: UserProfile, context: ModelContext) async -> Bool {
        guard !isGeneratingSet else { return false }
        isGeneratingSet = true
        setGenerationCompleting = false
        defer { isGeneratingSet = false }

        UIImpactFeedbackGenerator(style: .light).impactOccurred()

        do {
            let payloads = try await service.generateCuratedQuests(
                profile: profile,
                excludeTitles: completedTitles(in: context)
            )
            guard !payloads.isEmpty else {
                errorMessage = "No quests came back. Please try again."
                return false
            }

            // Rule 1 — replace previous unaccepted personalized cards.
            let existing = (try? context.fetch(FetchDescriptor<Quest>())) ?? []
            for quest in existing where quest.status == .available && quest.origin == .personalized {
                context.delete(quest)
            }

            for payload in payloads {
                context.insert(payload.makeQuest(origin: .personalized))
            }

            profile.lastCuratedGenerationDate = .now

            // Let the progress bar sprint to full before the reveal.
            setGenerationCompleting = true
            try? await Task.sleep(for: .milliseconds(500))

            UINotificationFeedbackGenerator().notificationOccurred(.success)
            return true
        } catch let error as CloudFunctionError {
            reconcile(error, into: \.lastCuratedGenerationDate, on: profile)
        } catch {
            errorMessage = error.localizedDescription
        }
        return false
    }

    /// Builds one quest from the user's freeform prompt and applies
    /// Rule 2: the deck holds a single custom slot, so the previous
    /// unaccepted described card is replaced. Active + completed are
    /// untouched. Returns true on success so the sheet can dismiss.
    func describeQuest(prompt: String, profile: UserProfile, context: ModelContext) async -> Bool {
        guard !isDescribing else { return false }
        isDescribing = true
        describeCompleting = false
        defer { isDescribing = false }

        UIImpactFeedbackGenerator(style: .light).impactOccurred()

        do {
            let payload = try await service.generateUserDescribedQuest(
                prompt: prompt,
                profile: profile
            )

            // Rule 2 — replace the previous unaccepted described card(s).
            let existing = (try? context.fetch(FetchDescriptor<Quest>())) ?? []
            for quest in existing where quest.status == .available && quest.origin == .described {
                context.delete(quest)
            }

            context.insert(payload.makeQuest(origin: .described, userPrompt: prompt))
            profile.lastDescribedGenerationDate = .now

            // Let the progress bar sprint to full before dismissing.
            describeCompleting = true
            try? await Task.sleep(for: .milliseconds(500))

            UINotificationFeedbackGenerator().notificationOccurred(.success)
            return true
        } catch let error as CloudFunctionError {
            reconcile(error, into: \.lastDescribedGenerationDate, on: profile)
        } catch {
            errorMessage = error.localizedDescription
        }
        return false
    }

    // MARK: Rate-limit reconciliation

    /// If the backend rejects with its 24h window, sync that lane's local
    /// gate to the server's `retryAt` (so the base card shows the
    /// recharge) instead of surfacing an error. Anything else is real.
    private func reconcile(
        _ error: CloudFunctionError,
        into stamp: ReferenceWritableKeyPath<UserProfile, Date?>,
        on profile: UserProfile
    ) {
        guard case .rateLimited(let retryAt) = error else {
            errorMessage = error.localizedDescription
            return
        }
        profile[keyPath: stamp] = retryAt?.addingTimeInterval(-GenerationLimit.window) ?? .now
    }

    private func completedTitles(in context: ModelContext) -> [String] {
        let all = (try? context.fetch(FetchDescriptor<Quest>())) ?? []
        return all.filter { $0.status == .completed }.map(\.title)
    }
}
