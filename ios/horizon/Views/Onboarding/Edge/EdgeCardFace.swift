//
//  EdgeCardFace.swift
//  horizon
//
//  One comfort-zone edge, laid out the way Explore lays out a quest. It is
//  the deck's only instruction, so it names both answers and their directions.
//

import SwiftUI
import UIKit

struct EdgeCardFace: View {
    let edge: ComfortZoneEdge
    let position: Int
    let total: Int
    let onPass: () -> Void
    let onCommit: () -> Void

    var body: some View {
        GeometryReader { geo in
            VStack(spacing: 0) {
                photoSection(height: geo.size.height * 0.5)
                caption
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 32))
        .background(
            RoundedRectangle(cornerRadius: 32)
                .fill(Color("AppSurface"))
        )
    }

    private func photoSection(height: CGFloat) -> some View {
        EdgePhoto(edge: edge)
            .frame(height: height)
            .clipped()
            // Each badge anchors to its own corner, like SwipeQuestCard —
            // sharing one VStack let the counter float on the credit's
            // (per-card) width instead of hugging the corner.
            .overlay(alignment: .topTrailing) {
                Text("\(position) of \(total)")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    // Static scrim, not glass — glass refracts the moving
                    // background while the card is being swiped.
                    .background(.black.opacity(0.45), in: Capsule())
                    .padding(14)
            }
            .overlay(alignment: .bottomTrailing) {
                if !edge.photoCredit.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "camera.fill")
                        Text("@\(edge.photoCredit)")
                    }
                    .font(.system(.caption, design: .default, weight: .medium))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    // Static scrim, not glass — like the counter above.
                    // Glass balloons under the card's per-frame drag
                    // transforms (offset/rotation/scale in DeckCardFrame).
                    .background(.black.opacity(0.45), in: Capsule())
                    .padding(14)
                }
            }
    }

    /// Centered, and typeset in three clear tiers so it's read in order.
    /// Nothing here is `AppPrimary` — the commit button owns that colour,
    /// and a peach question would compete with the answer it asks for.
    private var caption: some View {
        VStack(spacing: 8) {
            Text(edge.label)
                .font(.title)
                .fontWeight(.bold)
                .foregroundStyle(Color("AppPrimaryText"))
                .multilineTextAlignment(.center)
                // The longest preset wraps to three lines; shrink rather
                // than push the question and buttons off a short card.
                .lineLimit(3)
                .minimumScaleFactor(0.8)
                .fixedSize(horizontal: false, vertical: true)

            Text(edge.subline)
                .font(.callout)
                .foregroundStyle(Color("AppSecondaryText"))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 20)

            // The question sits with the buttons: neither answer parses
            // on its own, so they have to be read together.
            VStack(spacing: 16) {
                Text("Does this make you hesitate?")
                    .font(.headline)
                    .foregroundStyle(Color("AppPrimaryText"))
                    .multilineTextAlignment(.center)

                // Arrows point outward, so each label names the answer
                // AND the direction that gives it.
                DeckActionButtons(
                    passIcon: "xmark",
                    passLabel: "← Not really",
                    commitIcon: "checkmark",
                    commitLabel: "Yeah →",
                    passAccessibilityLabel: "This doesn't make me hesitate",
                    commitAccessibilityLabel: "This makes me hesitate",
                    onPass: onPass,
                    onCommit: onCommit
                )
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 24)
        .padding(.bottom, 20)
        .frame(maxWidth: .infinity)
    }
}

/// The photograph. Every preset now ships its own imageset, so the
/// bundled `sunset-sample` fallback is only a safety net for a missing
/// asset — in practice it never shows.
private struct EdgePhoto: View {
    let edge: ComfortZoneEdge

    private static let placeholder = "sunset-sample"

    private var asset: String {
        UIImage(named: edge.photo) != nil ? edge.photo : Self.placeholder
    }

    var body: some View {
        Color.clear
            .overlay {
                Image(asset)
                    .resizable()
                    .scaledToFill()
            }
            .clipped()
    }
}

// MARK: - Previews

// Faces render inside the deck's card shell, so the previews supply the
// same one — otherwise the photo/text split reads wrong.

#Preview("Edge card") {
    ZStack {
        AmbientBackground()
        EdgeCardFace(
            edge: ComfortZoneEdge.presets[0],
            position: 1,
            total: 10,
            onPass: {},
            onCommit: {}
        )
        .frame(height: 540)
        .clipShape(RoundedRectangle(cornerRadius: 32))
        .background(
            RoundedRectangle(cornerRadius: 32)
                .fill(Color("AppSurface"))
                .shadow(color: .black.opacity(0.16), radius: 22, y: 14)
        )
        .padding(.horizontal, 24)
    }
}

/// The longest label at the shortest height the deck will ever hand it —
/// where a two-line label plus question plus buttons runs out of room.
#Preview("Edge card · long label, short card") {
    ZStack {
        AmbientBackground()
        EdgeCardFace(
            edge: ComfortZoneEdge.presets[4],
            position: 5,
            total: 10,
            onPass: {},
            onCommit: {}
        )
        .frame(height: 400)
        .clipShape(RoundedRectangle(cornerRadius: 32))
        .background(
            RoundedRectangle(cornerRadius: 32)
                .fill(Color("AppSurface"))
                .shadow(color: .black.opacity(0.16), radius: 22, y: 14)
        )
        .padding(.horizontal, 24)
    }
}

