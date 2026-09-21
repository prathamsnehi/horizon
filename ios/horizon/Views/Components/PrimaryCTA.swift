//
//  PrimaryCTA.swift
//  horizon
//
//  The app's one primary-action look, in its two shapes: the full-width
//  capsule, and the bare gradient for places with another footprint.
//

import SwiftUI

extension ShapeStyle where Self == LinearGradient {
    /// The two-stop AppPrimary wash every primary action carries. The
    /// only gradient in the app besides legibility scrims.
    static var primaryCTA: LinearGradient {
        LinearGradient(
            colors: [Color("AppPrimary"), Color("AppPrimary").opacity(0.72)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}

extension View {
    /// Dresses a button's label as the primary CTA: `.headline` black
    /// text on the gradient capsule, full width, dimmed when disabled.
    /// Pair with `.buttonStyle(PressableButtonStyle())` and `.disabled`.
    func primaryCapsule(isEnabled: Bool = true) -> some View {
        self
            .font(.headline)
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 17)
            .background(.primaryCTA, in: Capsule())
            .opacity(isEnabled ? 1 : 0.4)
    }
}
