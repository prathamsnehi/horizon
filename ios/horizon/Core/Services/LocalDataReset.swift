//
//  LocalDataReset.swift
//  horizon
//
//  "Delete all data" in Settings: wipes the profile and every quest, then
//  drops back to onboarding. CloudKit mirroring propagates the deletions.
//

import Foundation
import SwiftData
import UIKit

@MainActor
enum LocalDataReset {
    /// Removes everything the app stores locally and returns to onboarding.
    /// Deliberately does NOT delete the anonymous Firebase user: a fresh uid
    /// would hand out a fresh 24h quota, making this a rate-limit bypass.
    static func wipe(context: ModelContext) {
        let quests = (try? context.fetch(FetchDescriptor<Quest>())) ?? []
        for quest in quests {
            context.delete(quest)
        }

        let profiles = (try? context.fetch(FetchDescriptor<UserProfile>())) ?? []
        for profile in profiles {
            context.delete(profile)
        }

        try? context.save()
        UserDefaults.standard.set(false, forKey: "hasCompletedOnboarding")
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}
