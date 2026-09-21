//
//  LogbookScreen.swift
//  horizon
//
//  Tab 3 — a vertical timeline of completed quests. The navigation path
//  lives on MainTabView so completion can deep-link into its new log.
//

import SwiftUI
import SwiftData

struct LogbookScreen: View {
    @Binding var path: [Quest]

    @Query private var quests: [Quest]

    private var completed: [Quest] {
        quests
            .filter { $0.status == .completed }
            .sorted { ($0.completedAt ?? .distantPast) > ($1.completedAt ?? .distantPast) } // newest first sort (newer date > older date in Swift)
    }

    var body: some View {
        NavigationStack(path: $path) {
            ZStack {
                AmbientBackground()

                if completed.isEmpty {
                    LogbookEmptyView()
                } else {
                    ScrollView(showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 0) {
                            LogbookHeader(count: completed.count)
                                .padding(.bottom, 32)

                            ForEach(Array(completed.enumerated()), id: \.element.id) { index, quest in
                                Button {
                                    path.append(quest)
                                } label: {
                                    TimelineQuestRow(quest: quest, isLast: index == completed.count - 1)
                                }
                                .buttonStyle(PressableButtonStyle())
                            }
                        }
                        .padding(.horizontal, 24)
                        .padding(.top, 16)
                        .padding(.bottom, 40)
                    }
                }
            }
            .navigationDestination(for: Quest.self) { quest in
                CompletedQuestDetailScreen(quest: quest)
            }
        }
    }
}

private struct LogbookHeader: View {
    let count: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow(text: "The Logbook", color: Color("AppPrimary"))

            Text("Your story so far.")
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundStyle(Color("AppPrimaryText"))

            Text(count == 1 ? "1 quest completed" : "\(count) quests completed")
                .font(.subheadline)
                .foregroundStyle(Color("AppSecondaryText"))
        }
    }
}

#Preview {
    LogbookScreen(path: .constant([]))
        .modelContainer(PreviewSwiftData.container)
}
