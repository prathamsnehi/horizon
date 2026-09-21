//
//  MainTabView.swift
//  horizon
//

import SwiftUI
import SwiftData

struct MainTabView: View {
    enum AppTab: Hashable {
        case quest, explore, logbook
    }

    @State private var selectedTab: AppTab = .quest

    // Owned here so completing a quest in QuestScreen can deep-link into the Logbook.
    @State private var logbookPath: [Quest] = []

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Quest", systemImage: "bookmark.fill", value: AppTab.quest) {
                QuestScreen(selectedTab: $selectedTab, logbookPath: $logbookPath)
            }

            Tab("Explore", systemImage: "globe.americas.fill", value: AppTab.explore) {
                ExploreScreen(selectedTab: $selectedTab)
            }

            Tab("Logbook", systemImage: "book.closed", value: AppTab.logbook) {
                LogbookScreen(path: $logbookPath)
            }
        }
        .tint(Color("AppPrimary"))
    }
}

#Preview {
    MainTabView()
        .modelContainer(PreviewSwiftData.container)
}
