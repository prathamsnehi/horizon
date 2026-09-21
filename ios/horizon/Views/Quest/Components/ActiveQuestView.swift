//
//  ActiveQuestView.swift
//  horizon
//
//  Composes the quest page: an uninterrupted hero photo, the place it
//  takes you, then the dossier sections.
//

import SwiftUI

struct ActiveQuestView: View {
    let quest: Quest
    @Binding var selectedTab: MainTabView.AppTab
    @Binding var logbookPath: [Quest]

    @State private var showConfetti = false
    @State private var showCompletionFlow = false

    var body: some View {
        GeometryReader { geo in
            ZStack {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: 0) {
                        // Draws above the panel, whose backdrop bleeds up
                        // behind the hero's rounded bottom corners.
                        QuestHeroSection(quest: quest, height: geo.size.height * 0.48)
                            .zIndex(1)

                        QuestContentPanel(
                            quest: quest,
                            onSwap: swapQuest,
                            onDidIt: openQuestCompletionScreen
                        )
                    }
                }

                if showConfetti {
                    ConfettiBurstView()
                }
            }
            .background(Color("AppBackground")) // bleed out background consistency
        }
        .ignoresSafeArea(edges: .top)
        .fullScreenCover(isPresented: $showCompletionFlow) {
            CompletionFlowScreen(
                quest: quest,
                onCompleted: {
                    showCompletionFlow = false
                    selectedTab = .logbook
                    logbookPath = [quest]
                },
                onClose: { showCompletionFlow = false }
            )
        }
    }

    /// Only opens the deck — the quest stays active until the user
    /// actually commits to another one, which swaps it out then
    /// (`Quest.activate(replacing:)`). Backing out costs nothing.
    private func swapQuest() {
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        selectedTab = .explore
    }

    /// Shows confetti burst upon clicking butotn, and opens up the quest completion flow screen
    private func openQuestCompletionScreen() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        showConfetti = true // celebration confetti
        Task {
            try? await Task.sleep(for: .seconds(ConfettiBurstView.duration))
            showConfetti = false
            showCompletionFlow = true
        }
    }
}

