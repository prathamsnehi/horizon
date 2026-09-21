//
//  QuestMasthead.swift
//  horizon
//
//  The line under the hero: where this quest takes you. Placeless quests put
//  the title here instead, and The Briefing then drops its own.
//

import SwiftUI

struct QuestMasthead: View {
    let quest: Quest

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(quest.locationInformation?.name ?? quest.title)
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundStyle(Color("AppPrimaryText"))
                .lineLimit(2)
                .minimumScaleFactor(0.75)
                .fixedSize(horizontal: false, vertical: true)

            if let distance = quest.locationInformation?.formattedDistanceMiles {
                Text(distance)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .tracking(1.5)
                    .textCase(.uppercase)
                    .foregroundStyle(Color("AppSecondaryText"))
                    .fixedSize()
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
