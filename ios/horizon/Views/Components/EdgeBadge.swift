//
//  EdgeBadge.swift
//  horizon
//
//  Says back which comfort-zone edge a quest was written for. Silent when
//  the backend named none; edges arrive in priority order, so limit: 1 works.
//

import SwiftUI

struct EdgeBadge: View {
    let edges: [String]
    /// Nil shows every edge; a limit collapses the rest into "+N",
    /// same as CategoryChips.
    var limit: Int?

    private var visible: [String] {
        guard let limit, edges.count > limit else { return edges }
        return Array(edges.prefix(limit))
    }

    private var overflow: Int { edges.count - visible.count }

    var body: some View {
        if !edges.isEmpty {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("Pushes")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .tracking(1.5)
                    .textCase(.uppercase)
                    .foregroundStyle(Color("AppSecondaryText"))
                    .fixedSize()

                Text(visible.joined(separator: " · ") + (overflow > 0 ? " +\(overflow)" : ""))
                    .font(.footnote)
                    .fontWeight(.medium)
                    .foregroundStyle(Color("AppPrimary"))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
