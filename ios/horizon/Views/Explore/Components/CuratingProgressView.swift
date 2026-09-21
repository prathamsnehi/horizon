//
//  CuratingProgressView.swift
//  horizon
//
//  Tentative progress for generation (~10s): eases out fast, lingers near
//  the end, then sprints to full when `isComplete` flips.
//

import SwiftUI

struct CuratingProgressView: View {
    /// Flip to true when the server response has arrived.
    let isComplete: Bool

    @State private var progress: CGFloat = 0
    @State private var messageIndex = 0

    private let messages = [
        "Reading your profile…",
        "Scouting real places nearby…",
        "Writing your quests…",
        "Adding the finishing touches…"
    ]

    var body: some View {
        VStack(spacing: 12) {
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color("AppSecondaryText").opacity(0.15))

                GeometryReader { geo in
                    Capsule()
                        .fill(Color("AppPrimary"))
                        .frame(width: max(6, geo.size.width * progress))
                }
            }
            .frame(height: 6)

            Text(messages[messageIndex])
                .font(.footnote)
                .foregroundStyle(Color("AppSecondaryText"))
                .contentTransition(.opacity)
                .animation(.easeInOut(duration: 0.3), value: messageIndex)
        }
        .onAppear {
            // Strong ease-out: most of the bar fills early, then it
            // crawls — never quite arriving until the response does.
            withAnimation(.timingCurve(0.1, 0.8, 0.2, 1.0, duration: 10)) {
                progress = 0.92
            }
        }
        .onChange(of: isComplete) { _, complete in
            if complete {
                withAnimation(.easeOut(duration: 0.35)) {
                    progress = 1
                }
            }
        }
        .task {
            // Advance the status line every few seconds, stopping on the last. (not looping cuz the messages in order and stopping at last makes sense)
            while !Task.isCancelled && messageIndex < messages.count - 1 {
                try? await Task.sleep(for: .seconds(2.8))
                if isComplete { break }
                messageIndex += 1
            }
        }
    }
}
