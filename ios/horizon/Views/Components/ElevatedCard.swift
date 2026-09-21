//
//  ElevatedCard.swift
//  horizon
//
//  Soft 3D elevation for a content section: surface fill plus a two-layer
//  shadow (tight contact + soft ambient).
//

import SwiftUI

private struct ElevatedCard: ViewModifier {
    var cornerRadius: CGFloat

    func body(content: Content) -> some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(20)
            .background(Color("AppSurface"), in: RoundedRectangle(cornerRadius: cornerRadius))
            .shadow(color: .black.opacity(0.05), radius: 3, y: 2)
            .shadow(color: .black.opacity(0.1), radius: 18, y: 10)
    }
}

extension View {
    func elevatedCard(cornerRadius: CGFloat = 24) -> some View {
        modifier(ElevatedCard(cornerRadius: cornerRadius))
    }
}
