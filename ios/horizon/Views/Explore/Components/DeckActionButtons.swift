//
//  DeckActionButtons.swift
//  horizon
//
//  The ✕ / ♥ buttons at the bottom of a quest card — tap equivalents of
//  swiping. The edge deck reuses this with its own icons and labels.
//

import SwiftUI

struct DeckActionButtons: View {
    var passIcon = "xmark"
    var passLabel = "Not now"
    var commitIcon = "heart.fill"
    var commitLabel = "Commit"
    /// VoiceOver labels. Default to the visible captions, but the edge
    /// deck overrides them — its captions carry directional arrows
    /// ("← Not really") that read awkwardly aloud.
    var passAccessibilityLabel: String? = nil
    var commitAccessibilityLabel: String? = nil
    let onPass: () -> Void
    let onCommit: () -> Void

    var body: some View {
        HStack(spacing: 48) {
            VStack(spacing: 6) {
                Button(action: onPass) {
                    Image(systemName: passIcon)
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color("AppPrimaryText"))
                        .frame(width: 58, height: 58)
                        .liquidGlass(in: Circle())
                }
                .buttonStyle(PressableButtonStyle())
                .accessibilityLabel(passAccessibilityLabel ?? passLabel)

                Text(passLabel)
                    .font(.caption2)
                    .foregroundStyle(Color("AppSecondaryText"))
            }

            VStack(spacing: 6) {
                Button(action: onCommit) {
                    Image(systemName: commitIcon)
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundStyle(.black)
                        .frame(width: 66, height: 66)
                        .background(.primaryCTA, in: Circle())
                }
                .buttonStyle(PressableButtonStyle())
                .accessibilityLabel(commitAccessibilityLabel ?? commitLabel)

                Text(commitLabel)
                    .font(.caption2)
                    .foregroundStyle(Color("AppSecondaryText"))
            }
        }
    }
}
