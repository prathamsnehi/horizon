//
//  CommitConfirmCard.swift
//  horizon
//
//  "Make this your quest?" — the one confirmation in the app, because
//  committing is the app's biggest action. Shown over a dimmed feed.
//

import SwiftUI

struct CommitConfirmCard: View {
    let quest: Quest
    let hasActiveQuest: Bool
    let onCommit: () -> Void
    let onCancel: () -> Void

    var body: some View {
        ZStack {
            Color.black.opacity(0.55)
                .ignoresSafeArea()
                .onTapGesture(perform: onCancel)

            VStack(alignment: .leading, spacing: 14) {
                Eyebrow(text: "One at a time", color: Color("AppPrimary"))

                Text(quest.title)
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundStyle(Color("AppPrimaryText"))

                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(Color("AppSecondaryText"))

                HStack(spacing: 12) {
                    Button(action: onCancel) {
                        Text("Not yet")
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundStyle(Color("AppPrimaryText"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .liquidGlass(in: Capsule())
                    }
                    .buttonStyle(PressableButtonStyle())

                    Button(action: onCommit) {
                        HStack(spacing: 6) {
                            Image(systemName: "heart.fill")
                            Text("Commit")
                        }
                        .font(.headline)
                        .foregroundStyle(.black)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(.primaryCTA, in: Capsule())
                    }
                    .buttonStyle(PressableButtonStyle())
                }
                .padding(.top, 6)
            }
            .elevatedCard()
            .padding(.horizontal, 32)
        }
    }

    private var message: String {
        hasActiveQuest
            ? "Make this your quest? Your current quest will return to the feed."
            : "Make this your quest? You'll commit to it — one quest at a time."
    }
}
