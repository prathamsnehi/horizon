import SwiftUI
import MapKit

struct QuestContentPanel: View {
    let quest: Quest
    let onSwap: () -> Void
    let onDidIt: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            VStack(alignment: .leading, spacing: 10) {
                QuestMasthead(quest: quest)
                EdgeBadge(edges: quest.pushesComfortZoneEdges)
            }

            QuestStatisticsSection(quest: quest)
                .elevatedCard()

            QuestBriefingSection(quest: quest, showsTitle: quest.locationInformation != nil)
                .elevatedCard()

            if let location = quest.locationInformation {
                QuestPlaceSection(location: location)
                    .elevatedCard()
            }

            QuestGuideSection(number: quest.locationInformation == nil ? "02" : "03")
                .elevatedCard()

            QuestActionButtonsSection(onSwap: onSwap, onDidIt: onDidIt)
                .padding(.top, 8)

            QuestColophon(text: quest.acceptedAgoText)
        }
        .padding(.horizontal, 24)
        .padding(.top, 28)
        .padding(.bottom, 48)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(QuestPanelBackground().padding(.top, -32)) // pull up the ambient bg a bit to account for rounded hero
    }
}

// MARK: - Actions

struct QuestActionButtonsSection: View {
    let onSwap: () -> Void
    let onDidIt: () -> Void

    var body: some View {
        VStack(spacing: 18) {
            Button(action: onDidIt) {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.seal.fill")
                    Text("I Did It")
                }
                .primaryCapsule()
            }
            .buttonStyle(PressableButtonStyle())

            Button(action: onSwap) {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                    Text("Swap for another quest")
                }
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundStyle(Color("AppSecondaryText"))
                .padding(.horizontal, 18)
                .padding(.vertical, 11)
                .liquidGlass(in: Capsule())
            }
            .buttonStyle(PressableButtonStyle())
            .frame(maxWidth: .infinity)
        }
    }
}

// MARK: - Colophon

/// The — ● — closing mark, with "Accepted N days ago" under it.
struct QuestColophon: View {
    let text: String?

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                ColophonLine()
                Image(systemName: "circle.fill")
                    .font(.system(size: 6))
                    .foregroundStyle(Color("AppPrimary"))
                ColophonLine()
            }

            if let text {
                Text(text)
                    .font(.caption)
                    .foregroundStyle(Color("AppSecondaryText"))
            }
        }
        .frame(maxWidth: .infinity)
    }
}

private struct ColophonLine: View {
    var body: some View {
        Rectangle()
            .fill(Color("AppSecondaryText").opacity(0.25))
            .frame(width: 36, height: 1)
    }
}

// MARK: - Panel background

/// AmbientBackground's washes, dimmer and repositioned for the panel
/// that sits under the hero.
struct QuestPanelBackground: View {
    var body: some View {
        ZStack {
            Color("AppBackground")

            RadialGradient(
                colors: [Color("AppPrimary").opacity(0.1), .clear],
                center: UnitPoint(x: 0.1, y: 0.0),
                startRadius: 0,
                endRadius: 420
            )

            RadialGradient(
                colors: [Color("AppPrimary").opacity(0.06), .clear],
                center: UnitPoint(x: 0.95, y: 0.85),
                startRadius: 0,
                endRadius: 380
            )
        }
        // Square top: the hero above supplies the curve now, and a
        // second rounding at the same seam pinches it.
    }
}
