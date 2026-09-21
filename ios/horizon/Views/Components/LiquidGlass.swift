//
//  LiquidGlass.swift
//  horizon
//
//  Liquid Glass with graceful degradation: real glassEffect on iOS 26+,
//  ultra-thin material earlier. The availability check lives here once.
//

import SwiftUI

extension View {
    /// Liquid Glass on iOS 26+, ultra-thin material earlier.
    ///
    /// Deliberately never interactive: interactive glass installs its own
    /// touch handling, which inside a Button label can win over the
    /// Button's and swallow the tap entirely. Press feedback comes from
    /// PressableButtonStyle; for a system-owned glass button, use
    /// `.buttonStyle(.glass)` rather than glass-on-label.
    @ViewBuilder
    func liquidGlass(
        in shape: some Shape,
        tint: Color? = nil
    ) -> some View {
        if #available(iOS 26.0, *) {
            self.glassEffect(.regular.tint(tint), in: shape)
        } else {
            self.background(.ultraThinMaterial, in: shape)
        }
    }
}
