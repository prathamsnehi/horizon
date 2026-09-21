//
//  SwipeQuestCard.swift
//  horizon
//
//  A quest as a Tinder-style card. Its inputs stay constant during a drag
//  so the body is never rebuilt mid-gesture — the parent only transforms it.
//

import SwiftUI

struct SwipeQuestCard: View {
    let quest: Quest
    let position: Int
    let total: Int
    let onPass: () -> Void
    let onCommit: () -> Void

    var body: some View {
        GeometryReader { geo in
            VStack(spacing: 0) {
                photoSection(height: geo.size.height * 0.5)
                QuestCardDetails(quest: quest, onPass: onPass, onCommit: onCommit)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 32))
        .background(
            RoundedRectangle(cornerRadius: 32)
                .fill(Color("AppSurface"))
        )
    }

    // MARK: Photo

    private func photoSection(height: CGFloat) -> some View {
        Color.clear
            .frame(height: height)
            .overlay {
                HeroImageView(photoData: quest.locationPhotoData)
            }
            .clipped()
            .overlay(alignment: .bottomLeading) {
                if let location = quest.locationInformation {
                    HStack(spacing: 5) {
                        Image(systemName: "mappin.and.ellipse")
                            .foregroundStyle(Color("AppPrimary"))
                        Text(placeLine(location))
                            .foregroundStyle(.white)
                            .lineLimit(1)
                    }
                    .font(.footnote)
                    .fontWeight(.medium)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    // Static scrim, not glass — glass refracts the moving
                    // background while the card is being swiped.
                    .background(.black.opacity(0.45), in: Capsule())
                    .padding(14)
                }
            }
            .overlay(alignment: .topTrailing) {
                VStack(alignment: .trailing, spacing: 8) {
                    Text("\(position) of \(total)")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(.white)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(.black.opacity(0.45), in: Capsule())

                    if quest.origin == .described {
                        Text("YOUR IDEA")
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .tracking(1.5)
                            .foregroundStyle(Color("AppPrimary"))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(.black.opacity(0.45), in: Capsule())
                    }
                }
                .padding(14)
            }
    }

    private func placeLine(_ location: LocationInformation) -> String {
        if let distance = location.formattedDistanceMiles {
            return "\(location.name) · \(distance)"
        }
        return location.name
    }
}

/// The dossier details below the photo: title, difficulty, time,
/// description, category chips, and the pass/commit buttons.
private struct QuestCardDetails: View {
    let quest: Quest
    let onPass: () -> Void
    let onCommit: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(quest.title)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundStyle(Color("AppPrimaryText"))
                .lineLimit(2)

            HStack(spacing: 8) {
                DifficultyPips(difficulty: quest.difficulty)

                Text(quest.difficulty.displayName)
                    .foregroundStyle(quest.difficulty.displayColor)

                Text("·")
                    .foregroundStyle(Color("AppSecondaryText"))

                Image(systemName: "clock")
                    .foregroundStyle(Color("AppSecondaryText"))
                Text(quest.formattedActivityTime)
                    .foregroundStyle(Color("AppPrimaryText"))
            }
            .font(.footnote)
            .fontWeight(.medium)

            EdgeBadge(edges: quest.pushesComfortZoneEdges, limit: 1)

            Text(quest.questDescription)
                .font(.subheadline)
                .foregroundStyle(Color("AppSecondaryText"))
                .lineLimit(3)

            CategoryChips(categories: quest.categories, limit: 5)

            Spacer(minLength: 0)

            DeckActionButtons(onPass: onPass, onCommit: onCommit)
                .frame(maxWidth: .infinity)
                .padding(.bottom, 6)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
