//
//  SwipeHint.swift
//  horizon
//
//  The instruction under a SwipeDeck: an arrow bobbing in the direction
//  the current card wants, emphasized after a wrong-direction attempt.
//

import SwiftUI

struct SwipeHint: View {
    enum Direction {
        case left, right
        /// Both ways are valid — arrows on either side of the text.
        case both
    }

    struct Config {
        let text: String
        let direction: Direction
    }

    let config: Config
    let emphasized: Bool

    var body: some View {
        HStack(spacing: 10) {
            if config.direction != .right { arrow(pointingLeft: true) }

            Text(config.text)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(emphasized ? Color("AppPrimary") : Color("AppPrimaryText"))

            if config.direction != .left { arrow(pointingLeft: false) }
        }
        .scaleEffect(emphasized ? 1.06 : 1)
    }

    private func arrow(pointingLeft: Bool) -> some View {
        Image(systemName: pointingLeft ? "arrow.left" : "arrow.right")
            .font(.title3)
            .fontWeight(.semibold)
            .foregroundStyle(Color("AppPrimary"))
            .phaseAnimator([false, true]) { view, phase in
                view
                    .offset(x: (pointingLeft ? -1 : 1) * (phase ? 9 : -5))
                    .opacity(phase ? 1 : 0.45)
            } animation: { _ in
                .easeInOut(duration: 1.1)
            }
    }
}
