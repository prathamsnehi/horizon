//
//  horizonApp.swift
//  horizon
//
//  Created by Pratham S on 6/8/26.
//

import SwiftUI
import SwiftData
import FirebaseCore
import FirebaseAppCheck

@main
struct horizonApp: App {

    /// The launch gate — a plain UserDefaults flag (readable synchronously,
    /// unlike a SwiftData query). Flipped by OnboardingFlowScreen's
    /// onFinished, i.e. the walkthrough's Start button.
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false

    @Environment(\.scenePhase) private var scenePhase

    let sharedContainer: ModelContainer

    init() {
        #if DEBUG
        AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
        #else
        AppCheck.setAppCheckProviderFactory(HorizonAppCheckProviderFactory())
        #endif
        FirebaseApp.configure()

        let schema = Schema([
            Quest.self,
            UserProfile.self
        ])

        // CloudKit mirroring — this one option is the whole sync engine.
        // Models must keep every property defaulted/optional for it.
        let modelConfiguration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false,
            cloudKitDatabase: .automatic
        )

        do {
            sharedContainer = try ModelContainer(for: schema, configurations: [modelConfiguration])
        } catch {
            fatalError("Could not create ModelContainer: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if hasCompletedOnboarding {
                    MainTabView()
                } else {
                    OnboardingFlowScreen(onFinished: {
                        withAnimation(.easeInOut(duration: 0.4)) {
                            hasCompletedOnboarding = true
                        }
                    })
                }
            }
            // Synced-in data lands on foreground, so dedupe there.
            .onChange(of: scenePhase) { _, newPhase in
                guard newPhase == .active else { return }
                dedupeProfiles()
            }
        }
        .modelContainer(sharedContainer)
    }

    /// The profile is a singleton by convention, but CloudKit merging
    /// can't know that — keep the most recently updated one.
    private func dedupeProfiles() {
        let context = sharedContainer.mainContext
        let profiles = (try? context.fetch(FetchDescriptor<UserProfile>())) ?? []
        guard profiles.count > 1 else { return }
        let sorted = profiles.sorted { $0.updatedAt > $1.updatedAt }
        for stale in sorted.dropFirst() {
            context.delete(stale)
        }
    }
}

/// App Attest for release builds (falls back per Firebase defaults).
final class HorizonAppCheckProviderFactory: NSObject, AppCheckProviderFactory {
    func createProvider(with app: FirebaseApp) -> AppCheckProvider? {
        AppAttestProvider(app: app)
    }
}
