//
//  ResonanceSymbol.swift
//  horizon
//
//  The single large SF Symbol on a message card: fades in on reveal, plays
//  its effect once, holds still. Generic over the effect, so cards choose.
//

import SwiftUI
import Symbols

struct ResonanceSymbol<Effect: DiscreteSymbolEffect & SymbolEffect>: View {
    let systemName: String
    /// Cards pre-render behind the top card, so an onAppear fade would
    /// play invisibly — the reveal is what triggers the entrance.
    let isRevealed: Bool
    let effect: Effect

    private let pointSize: CGFloat = 96

    @State private var shown = false
    @State private var effectTrigger = 0

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: pointSize, weight: .light))
            .foregroundStyle(Color("AppPrimary"))
            .opacity(shown ? 1 : 0)
            .scaleEffect(shown ? 1 : 0.96)
            .symbolEffect(effect, options: .nonRepeating, value: effectTrigger)
            .frame(height: pointSize * 1.75)
            .onAppear(perform: revealIfTop)
            .onChange(of: isRevealed) { revealIfTop() }
    }

    private func revealIfTop() {
        guard isRevealed, !shown else { return }

        withAnimation(.easeOut(duration: 0.7)) {
            shown = true
        }

        Task {
            // Let the fade land, then settle exactly once.
            try? await Task.sleep(for: .milliseconds(750))
            effectTrigger += 1
        }
    }
}

#Preview("Resonance symbol") {
    ZStack {
        AmbientBackground()
        ResonanceSymbol(systemName: "sun.horizon.fill", isRevealed: true, effect: .bounce)
    }
}
