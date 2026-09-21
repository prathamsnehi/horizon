//
//  WalkthroughDemos.swift
//  horizon
//
//  The vignette in the walkthrough info card's header: the two daily actions
//  dealing the cards they yield. Plays once on reveal, then holds still.
//

import SwiftUI

// MARK: - Shared miniature quest card

/// A tiny abstract quest card — photo block plus two text hairlines —
/// standing in for real deck cards inside the vignettes.
private struct MiniQuestCard: View {
    var width: CGFloat = 30

    private var height: CGFloat { width * 1.4 }

    private var hairline: CGFloat { max(2.5, width * 0.06) }

    var body: some View {
        VStack(alignment: .leading, spacing: width * 0.12) {
            RoundedRectangle(cornerRadius: width * 0.1)
                .fill(Color("AppPrimary").opacity(0.22))
                .frame(height: height * 0.36)
            Capsule()
                .fill(Color("AppSecondaryText").opacity(0.4))
                .frame(width: width * 0.62, height: hairline)
            Capsule()
                .fill(Color("AppSecondaryText").opacity(0.25))
                .frame(width: width * 0.4, height: hairline)
        }
        .padding(width * 0.14)
        .frame(width: width, height: height, alignment: .top)
        .background(
            // Opaque base under the peach wash so overlapping cards
            // occlude each other instead of showing through.
            RoundedRectangle(cornerRadius: width * 0.2)
                .fill(Color("AppSurface"))
                .overlay(
                    RoundedRectangle(cornerRadius: width * 0.2)
                        .fill(Color("AppPrimary").opacity(0.08))
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: width * 0.2)
                .strokeBorder(Color("AppPrimary").opacity(0.35), lineWidth: 1)
        )
    }
}

// MARK: - Two ways to get quests

/// The two daily action capsules, each dealing what it yields: the
/// curated capsule pulses and fans out a set of three mini cards, then
/// the describe capsule deals exactly one. The 3-vs-1 asymmetry is the
/// point. Plays once on reveal, sequentially.
struct DailyActionsDemo: View {
    let isRevealed: Bool

    @State private var started = false
    @State private var curatedPulse = false
    @State private var describedPulse = false
    @State private var curatedDealt = false
    @State private var describedDealt = false

    var body: some View {
        VStack(spacing: 24) {
            HStack {
                MiniActionCapsule(icon: "sparkles", label: "Generate Your Set", emphasized: curatedPulse)
                Spacer()
                MiniCardFan(count: 3, dealt: curatedDealt)
            }
            HStack {
                MiniActionCapsule(icon: "square.and.pencil", label: "Describe Your Own", emphasized: describedPulse)
                Spacer()
                MiniCardFan(count: 1, dealt: describedDealt)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 190)
        .onAppear(perform: playIfTop)
        .onChange(of: isRevealed) { playIfTop() }
    }

    private func playIfTop() {
        guard isRevealed, !started else { return }
        started = true
        Task {
            try? await Task.sleep(for: .milliseconds(450))
            withAnimation(.spring(response: 0.25, dampingFraction: 0.6)) { curatedPulse = true }
            try? await Task.sleep(for: .milliseconds(220))
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) { curatedPulse = false }
            curatedDealt = true // the fan staggers its own springs

            try? await Task.sleep(for: .milliseconds(1000))
            withAnimation(.spring(response: 0.25, dampingFraction: 0.6)) { describedPulse = true }
            try? await Task.sleep(for: .milliseconds(220))
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) { describedPulse = false }
            describedDealt = true
        }
    }
}

private struct MiniActionCapsule: View {
    let icon: String
    let label: String
    let emphasized: Bool

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
            Text(label)
        }
        .font(.footnote)
        .fontWeight(.medium)
        .foregroundStyle(Color("AppPrimaryText"))
        .padding(.vertical, 11)
        // Fixed width (not text-hugging) so both capsules match.
        .frame(width: 170)
        .background(
            Capsule().fill(Color("AppPrimary").opacity(emphasized ? 0.22 : 0.10))
        )
        .overlay(
            Capsule().strokeBorder(Color("AppPrimary").opacity(emphasized ? 0.8 : 0.4), lineWidth: 1)
        )
        .scaleEffect(emphasized ? 1.05 : 1)
    }
}

/// Mini cards fanning out of a capsule, staggered like a dealt hand.
private struct MiniCardFan: View {
    let count: Int
    let dealt: Bool

    var body: some View {
        ZStack {
            ForEach(0..<count, id: \.self) { index in
                let spread = Double(index) - Double(count - 1) / 2 // e.g. -1, 0, 1

                MiniQuestCard(width: 40)
                    .rotationEffect(.degrees(dealt ? spread * 10 : 0), anchor: .bottom)
                    .offset(
                        x: dealt ? spread * 26 : -32,
                        y: dealt ? abs(spread) * 4 : 0
                    )
                    .scaleEffect(dealt ? 1 : 0.3, anchor: .leading)
                    .opacity(dealt ? 1 : 0)
                    // The middle card sits on top of the fan.
                    .zIndex(-abs(spread))
                    .animation(
                        .spring(response: 0.5, dampingFraction: 0.72).delay(Double(index) * 0.07),
                        value: dealt
                    )
            }
        }
        .frame(width: 100, height: 64)
    }
}

// MARK: - Preview

// isRevealed drives the one-shot entrance, so this passes true to show
// the settled state. Re-run the preview to replay the animation.

#Preview("Daily actions demo") {
    ZStack {
        AmbientBackground()
        DailyActionsDemo(isRevealed: true).padding(28)
    }
}
