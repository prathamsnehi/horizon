//
//  QuestScreen.swift
//  horizon
//
//  Tab 1 — the single active quest, or an empty state pointing to Explore.
//

import SwiftUI
import SwiftData

struct QuestScreen: View {
    @Binding var selectedTab: MainTabView.AppTab
    @Binding var logbookPath: [Quest]
    @Query private var quests: [Quest]

    private var activeQuest: Quest? {
        quests.first { $0.status == .active }
    }

    var body: some View {
        if let quest = activeQuest {
            ActiveQuestView(quest: quest, selectedTab: $selectedTab, logbookPath: $logbookPath)
        } else {
            EmptyQuestView(selectedTab: $selectedTab)
        }
    }
}


#Preview {
    QuestScreen(selectedTab: .constant(.quest), logbookPath: .constant([]))
        .modelContainer(PreviewSwiftData.container)
}
