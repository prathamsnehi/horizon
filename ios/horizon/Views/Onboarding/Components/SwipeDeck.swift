//
//  SwipeDeck.swift
//  horizon
//
//  A finite, non-looping swipe deck — deliberately separate from Explore's
//  DeckStack. Physics only: it knows nothing about what a swipe means.
//

import SwiftUI
import UIKit

enum SwipeDirection {
    case left, right
}

/// What the card builder is handed for each visible card.
struct SwipeDeckCard<Item> {
    let item: Item
    let index: Int
    /// Cards pre-render behind the top one, so entrance animations key
    /// off this rather than onAppear.
    let isTopCard: Bool
    /// Drives the deck as if the card were swiped that way — for faces
    /// carrying their own ✕/✓ buttons.
    let swipe: (SwipeDirection) -> Void
}

struct SwipeDeck<Item: Identifiable, Card: View>: View {
    let items: [Item]
    /// The instruction under the deck. Nil collapses the row, and the
    /// cards get its height.
    var hint: (Item) -> SwipeHint.Config? = { _ in nil }
    /// Fires once, after the last card flies away.
    let onFinished: () -> Void
    /// Whether the swipe is accepted. Async so a handler can await a
    /// confirmation dialog while the card hangs mid-flight; returning
    /// false springs the card back and nudges the hint.
    let onSwipe: @MainActor (Item, SwipeDirection) async -> Bool
    /// Last, so it reads as the deck's body in a trailing closure.
    @ViewBuilder let card: (SwipeDeckCard<Item>) -> Card

    @State private var index = 0
    @State private var dragOffset: CGSize = .zero
    @State private var isResolving = false
    @State private var nudges = 0
    @State private var hintEmphasized = false

    private let threshold: CGFloat = 120
    private let holdDistance: CGFloat = 340
    private var flyOutDistance: CGFloat { UIScreen.main.bounds.width * 1.5 }

    /// How long a committed card takes to fly off screen. The animation
    /// and the wait before the deck advances are both driven by this, so
    /// they can't drift apart (a shorter wait would snap the card back
    /// mid-flight).
    private let swipeOutDuration: TimeInterval = 0.5

    /// -1…1, left…right.
    private var dragProgress: CGFloat {
        max(-1, min(1, dragOffset.width / threshold))
    }

    private var currentItem: Item? {
        index < items.count ? items[index] : nil
    }

    var body: some View {
        VStack(spacing: 20) {
            GeometryReader { geo in
                ZStack(alignment: .top) {
                    ForEach([index + 1, index], id: \.self) { cardIndex in
                        if cardIndex < items.count {
                            CardFrame(
                                depth: cardIndex - index,
                                dragProgress: dragProgress,
                                dragOffset: dragOffset,
                                size: CGSize(width: geo.size.width, height: geo.size.height - 12),
                                gesture: dragGesture
                            ) {
                                card(SwipeDeckCard(
                                    item: items[cardIndex],
                                    index: cardIndex,
                                    isTopCard: cardIndex == index,
                                    swipe: { direction in Task { await resolve(direction) } }
                                ))
                            }
                        }
                    }
                }
            }

            // No per-item identity: the hint persists across advances so
            // the arrow's bobbing never resets — only its values update.
            if let item = currentItem, let config = hint(item) {
                SwipeHint(config: config, emphasized: hintEmphasized)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: index)
        .sensoryFeedback(.warning, trigger: nudges)
    }

    // MARK: Gesture

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                guard !isResolving else { return }
                dragOffset = value.translation
            }
            .onEnded { value in
                let projected = value.predictedEndTranslation.width

                if value.translation.width < -threshold || projected < -threshold * 2.5 {
                    Task { await resolve(.left) }
                } else if value.translation.width > threshold || projected > threshold * 2.5 {
                    Task { await resolve(.right) }
                } else {
                    springBack()
                }
            }
    }

    // MARK: Resolution

    /// The one path a swipe takes, whether it came from the drag or from
    /// a button on the card face.
    private func resolve(_ direction: SwipeDirection) async {
        guard !isResolving, let item = currentItem else { return }
        isResolving = true
        defer { isResolving = false }

        // Park the card where the caller can see it committed. A handler
        // that answers immediately has this superseded by the fly-out on
        // the next tick, so the two read as one continuous motion.
        let sign: CGFloat = direction == .left ? -1 : 1
        withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
            dragOffset.width = sign * max(abs(dragOffset.width), holdDistance)
        }

        guard await onSwipe(item, direction) else {
            nudge()
            return
        }

        withAnimation(.easeOut(duration: swipeOutDuration)) {
            dragOffset.width = sign * flyOutDistance
        }
        try? await Task.sleep(for: .seconds(swipeOutDuration))

        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            index += 1
            dragOffset = .zero
        }

        if index >= items.count {
            onFinished()
        }
    }

    private func nudge() {
        nudges += 1
        springBack()
        withAnimation(.spring(response: 0.3, dampingFraction: 0.6)) {
            hintEmphasized = true
        }
        Task {
            try? await Task.sleep(for: .milliseconds(700))
            withAnimation(.easeOut(duration: 0.3)) {
                hintEmphasized = false
            }
        }
    }

    private func springBack() {
        withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
            dragOffset = .zero
        }
    }
}

// MARK: - Per-card presentation

private struct CardFrame<SwipeGesture: Gesture, Content: View>: View {
    let depth: Int
    let dragProgress: CGFloat
    let dragOffset: CGSize
    let size: CGSize
    let gesture: SwipeGesture
    @ViewBuilder let content: () -> Content

    var body: some View {
        let lift = depth == 1 ? min(1, abs(dragProgress)) : 0
        let isTopCard = depth == 0
        let shadowStrength = Double(isTopCard ? 1 : lift)

        content()
            .frame(width: size.width, height: size.height)
            // Edge cards are full-bleed photos; the shell owns the corners.
            .clipShape(RoundedRectangle(cornerRadius: 32))
            .background(
                RoundedRectangle(cornerRadius: 32)
                    .fill(Color("AppSurface"))
                    .shadow(color: .black.opacity(0.07 * shadowStrength), radius: 4, y: 3)
                    .shadow(color: .black.opacity(0.16 * shadowStrength), radius: 22, y: 14)
            )
            .scaleEffect(isTopCard ? 1 : 0.94 + 0.06 * lift)
            .offset(y: isTopCard ? 0 : 14 - lift * 14)
            .offset(isTopCard ? dragOffset : .zero)
            .rotationEffect(
                .degrees(isTopCard ? Double(dragOffset.width / 18) : 0),
                anchor: .bottom
            )
            .gesture(gesture, including: isTopCard ? .all : .subviews)
    }
}
