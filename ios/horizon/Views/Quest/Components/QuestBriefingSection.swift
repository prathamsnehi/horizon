import SwiftUI

// MARK: - QuestBriefingSection
struct QuestBriefingSection: View {
    let quest: Quest
    /// False on quests with no place, where the masthead already carries
    /// the title.
    var showsTitle = true

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Eyebrow(text: "The Briefing", number: "01")

            if showsTitle {
                Text(quest.title)
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundStyle(Color("AppPrimaryText"))
                    .fixedSize(horizontal: false, vertical: true)
            }

            Text(quest.questDescription)
                .font(.body)
                .lineSpacing(5)
                .foregroundStyle(Color("AppPrimaryText"))

            CategoryChips(categories: quest.categories)
        }
    }
}

