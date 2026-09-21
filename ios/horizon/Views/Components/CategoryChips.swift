//
//  CategoryChips.swift
//  horizon
//
//  Row of small capsule chips for quest categories.
//

import SwiftUI

struct CategoryChips: View {
    let categories: [String]
    /// Cap on visible chips; overflow collapses into a "+N" chip.
    var limit: Int? = nil

    // Shortest first packs rows more evenly and avoids a lone wide chip
    // forcing an early line break.
    private var sortedCategories: [String] {
        categories.sorted { $0.count < $1.count }
    }

    private var visibleCategories: [String] {
        guard let limit, sortedCategories.count > limit else { return sortedCategories }
        return Array(sortedCategories.prefix(limit))
    }

    private var overflowCount: Int {
        sortedCategories.count - visibleCategories.count
    }

    var body: some View {
        FlowLayout(spacing: 8) {
            ForEach(visibleCategories, id: \.self) { category in
                chip(category)
            }

            if overflowCount > 0 {
                chip("+\(overflowCount)")
            }
        }
    }

    private func chip(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .lineLimit(1)
            .fixedSize()
            .foregroundStyle(Color("AppSecondaryText"))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .overlay(
                Capsule().strokeBorder(
                    Color("AppSecondaryText").opacity(0.28),
                    lineWidth: 1
                )
            )
    }
}

#Preview {
    CategoryChips(categories: ["Nature", "Fitness", "Photography", "Getting outdoors more", "Physical challenge"])
        .padding()
        .background(Color("AppBackground"))
}
