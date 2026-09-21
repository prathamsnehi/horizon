//
//  QuestStatisticsSection.swift
//  horizon
//
//  The two free-floating stats under the masthead: how far past the
//  comfort zone this quest sits, and how long it takes.
//

import SwiftUI

struct QuestStatisticsSection: View {
    let quest: Quest

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            QuestDifficultyStat(difficulty: quest.difficulty)
                .frame(maxWidth: .infinity)

            QuestActivityTimeStat(timeString: quest.formattedActivityTime)
                .frame(maxWidth: .infinity)
        }
    }
}

private struct QuestDifficultyStat: View {
    let difficulty: DifficultyRating
    
    var body: some View {
        VStack(alignment: .center, spacing: 5) {
            MicroLabel(text: "Comfort zone")

            Text(difficulty.displayName)
                .foregroundStyle(difficulty.displayColor)
                .font(.title3)
                .fontWeight(.semibold)
        }
    }
}

private struct QuestActivityTimeStat: View {
    let timeString: String
    
    var body: some View {
        VStack(alignment: .center, spacing: 5) {
            MicroLabel(text: "Activity time")

            Text(timeString)
                .foregroundStyle(Color("AppPrimaryText"))
                .font(.title3)
                .fontWeight(.semibold)
        }
    }
}
