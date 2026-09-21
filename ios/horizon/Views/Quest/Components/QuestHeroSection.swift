//
//  QuestHeroSection.swift
//  horizon
//
//  The place photo, uninterrupted. It stretches on pull-down but its layout
//  height stays fixed, so the growth is visual and nothing below it moves.
//

import SwiftUI

struct QuestHeroSection: View {
    let quest: Quest
    let height: CGFloat

    var body: some View {
        GeometryReader { proxy in
            let stretch = max(0, proxy.frame(in: .scrollView).minY)

            HeroImageView(photoData: quest.locationPhotoData)
                .frame(width: proxy.size.width, height: height + stretch)
                .clipped()
                .overlay(alignment: .top) { StatusBarScrim() }
                .clipShape(
                    UnevenRoundedRectangle(
                        bottomLeadingRadius: 32,
                        bottomTrailingRadius: 32
                    )
                )
                .offset(y: -stretch)
        }
        .frame(height: height)
    }
}

/// Just enough darkening for the clock and battery to stay legible on a
/// bright photo — the image itself is left alone.
private struct StatusBarScrim: View {
    var body: some View {
        LinearGradient(
            colors: [.black.opacity(0.28), .clear],
            startPoint: .top,
            endPoint: .bottom
        )
        .frame(height: 120)
    }
}
