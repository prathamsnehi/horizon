//
//  AmbientBackground.swift
//  horizon
//
//  Ambient page background: the base color washed with two soft radial
//  glows so full screens have depth instead of a flat fill.
//

import SwiftUI

struct AmbientBackground: View {
    var accent: Color = Color("AppPrimary")

    var body: some View {
        ZStack {
            Color("AppBackground")

            RadialGradient(
                colors: [accent.opacity(0.16), .clear],
                center: UnitPoint(x: 0.1, y: 0.05),
                startRadius: 0,
                endRadius: 420
            )

            RadialGradient(
                colors: [accent.opacity(0.09), .clear],
                center: UnitPoint(x: 0.95, y: 0.8),
                startRadius: 0,
                endRadius: 380
            )
        }
        .ignoresSafeArea()
    }
}
