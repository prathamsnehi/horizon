//
//  CompletedBriefingSection.swift
//  horizon
//
//  The original quest, kept with the log for context: description,
//  place, and categories.
//

import SwiftUI

struct CompletedBriefingSection: View {
    let quest: Quest
    var number: String = "03"

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Eyebrow(text: "The Quest", color: Color("AppPrimary"), number: number)

            Text(quest.questDescription)
                .font(.body)
                .lineSpacing(5)
                .foregroundStyle(Color("AppPrimaryText"))

            // The whole point of the log: which edges this one crossed.
            EdgeBadge(edges: quest.pushesComfortZoneEdges)

            if let location = quest.locationInformation {
                HStack(spacing: 6) {
                    Image(systemName: "mappin.and.ellipse")
                        .foregroundStyle(Color("AppPrimary"))
                    Text(location.name)
                        .foregroundStyle(Color("AppSecondaryText"))
                }
                .font(.footnote)
                .fontWeight(.medium)
            }

            CategoryChips(categories: quest.categories)
        }
    }
}
