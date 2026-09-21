//
//  CompletedQuestDetailScreen.swift
//  horizon
//
//  The full log of a completed quest. Read-only by default; the toolbar
//  Edit button unlocks journal editing and photo add/remove.
//

import SwiftUI

struct CompletedQuestDetailScreen: View {
    let quest: Quest

    @State private var isEditing = false

    var body: some View {
        ZStack {
            AmbientBackground()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 28) {
                    CompletedLogHeader(quest: quest)

                    CompletedGallerySection(quest: quest, isEditing: isEditing)
                        .elevatedCard()

                    CompletedStorySection(quest: quest, isEditing: isEditing)
                        .elevatedCard()

                    if let location = quest.locationInformation {
                        CompletedPlaceSection(location: location, photoData: quest.locationPhotoData)
                            .elevatedCard()
                    }

                    CompletedBriefingSection(
                        quest: quest,
                        number: quest.locationInformation == nil ? "03" : "04"
                    )
                    .elevatedCard()

                    QuestColophon(text: quest.completedDateLabel.map { "Completed \($0)" })
                }
                .padding(24)
                .padding(.bottom, 24)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.hidden, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(isEditing ? "Done" : "Edit") {
                    withAnimation(.easeInOut(duration: 0.15)) {
                        isEditing.toggle()
                    }
                }
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(Color("AppPrimary"))
            }
        }
    }
}

private struct CompletedLogHeader: View {
    let quest: Quest

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow(text: eyebrowText, color: Color("AppPrimary"))

            Text(quest.title)
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundStyle(Color("AppPrimaryText"))
        }
        .padding(.top, 8)
    }

    private var eyebrowText: String {
        if let label = quest.completedDateLabel {
            "Completed · \(label)"
        } else {
            "Completed"
        }
    }
}

#Preview {
    let quest: Quest = {
        let quest = Quest(
            title: "Golden-Hour Photo Walk",
            questDescription: "Chase the last light along the river and photograph three strangers' dogs (with permission).",
            difficulty: .moderate,
            estimatedActivityMinutes: 60,
            categories: ["outdoors", "creativity"]
        )
        quest.status = .completed
        quest.completedAt = .now
        quest.journalEntry = "The light was unreal. Met a corgi named Biscuit."
        return quest
    }()

    NavigationStack {
        CompletedQuestDetailScreen(quest: quest)
    }
}
