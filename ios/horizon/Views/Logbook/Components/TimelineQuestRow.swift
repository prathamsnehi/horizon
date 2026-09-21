//
//  TimelineQuestRow.swift
//  horizon
//
//  One entry on the logbook timeline: a ● node on the vertical rail,
//  the completion date as a micro-label, and a compact log card.
//

import SwiftUI

struct TimelineQuestRow: View {
    let quest: Quest
    let isLast: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            TimelineRail(isLast: isLast)

            VStack(alignment: .leading, spacing: 10) {
                if let date = quest.completedDateLabel {
                    MicroLabel(text: date)
                }

                HStack(spacing: 12) {
                    RowThumbnail(quest: quest)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(quest.title)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(Color("AppPrimaryText"))
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        Text(subtitle)
                            .font(.caption)
                            .foregroundStyle(Color("AppSecondaryText"))
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)

                        EdgeBadge(edges: quest.pushesComfortZoneEdges, limit: 1)
                            .padding(.top, 2)
                    }

                    Spacer(minLength: 0)

                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color("AppSecondaryText"))
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color("AppSurface"), in: RoundedRectangle(cornerRadius: 18))
                .padding(.bottom, 24)
            }
        }
    }

    private var subtitle: String {
        quest.journalEntry ?? quest.locationInformation?.name ?? quest.questDescription // cook up js anything in the subtitle
    }
}

private struct TimelineRail: View {
    let isLast: Bool

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "circle.fill")
                .font(.system(size: 8))
                .foregroundStyle(Color("AppPrimary"))
                .padding(.top, 3)

            if !isLast {
                Rectangle()
                    .fill(Color("AppSecondaryText").opacity(0.22))
                    .frame(width: 1)
                    .frame(maxHeight: .infinity)
            }
        }
    }
}

private struct RowThumbnail: View {
    let quest: Quest

    var body: some View {
        Group {
            if let data = quest.journalPhotoData.first,
               let image = PhotoCache.image(for: data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                HeroImageView(photoData: quest.locationPhotoData)
            }
        }
        .frame(width: 56, height: 56)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
