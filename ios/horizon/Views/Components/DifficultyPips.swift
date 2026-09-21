//
//  DifficultyPips.swift
//  horizon
//
//  Four dot pips filled up to the quest's difficulty level.
//

import SwiftUI

struct DifficultyPips: View {
    let difficulty: DifficultyRating

    var body: some View {
        let level = DifficultyRating.allCases.firstIndex(of: difficulty) ?? 0

        HStack(spacing: 3) {
            ForEach(0..<4) { index in
                Image(systemName: "circle.fill")
                    .font(.system(size: 8))
                    .foregroundStyle(
                        index <= level
                            ? difficulty.displayColor
                            : Color("AppSecondaryText").opacity(0.3)
                    )
            }
        }
        // Decorative — the difficulty's displayName is shown beside it.
        .accessibilityHidden(true)
    }
}
