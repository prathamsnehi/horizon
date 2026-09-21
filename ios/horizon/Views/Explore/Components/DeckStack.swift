//
//  DeckStack.swift
//  horizon
//
//  Explore's swipe-deck machinery: DeckEntry, DeckStack, DeckCardContent,
//  DeckCardFrame (depth + top-card drag), and DirectionTint.
//

import SwiftUI

/// One slot in the looping deck cycle: [base card, quest 1 … quest N].
enum DeckEntry {
    case base // base card that gives option to generate or describe (and rate limit in the future)
    case quest(Quest, position: Int)
}

/// What cards can ask the screen to do. onPass/onCommit are here because
/// the card's own ✕/♥ buttons need them — the swipe gestures alone are
/// handled by the screen and wouldn't have to be passed down.
struct DeckActions {
    let onGenerate: () -> Void
    let onDescribe: () -> Void
    let onTuneProfile: () -> Void
    let onPass: () -> Void
    let onCommit: () -> Void
}

/// The base card's curating state.
struct GenerationStatus {
    let isRunning: Bool // when true, show & start the loading bar when request sent ("fake" loading bar)
    let isCompleting: Bool // when true, response received from the server, completing the remaining of the fake loading bar, sleep for a bit, then show the response received from the backend
}

/// Last-run timestamps for the two daily actions, driving the base
/// card's 24h recharge gating (see `GenerationLimit`, which owns the
/// window itself). `nil` = never used (available now).
struct DailyActionStamps {
    let curatedLast: Date?
    let describedLast: Date?
}

/// A Stack that renders 3 cards at a time within ExploreScreen.
/// Technically, only 2 are required (the front card, and the card behind it to appear when swiping)
/// The third one is to give the fetch request to get an image more than enough time
struct DeckStack<SwipeGesture: Gesture>: View {
    let deckIndex: Int
    let deck: [DeckEntry]
    /// -1…1, left…right.
    let dragProgress: CGFloat
    let dragOffset: CGSize
    let gesture: SwipeGesture
    let generation: GenerationStatus
    let limits: DailyActionStamps
    let actions: DeckActions

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .top) {
                ForEach([deckIndex + 2, deckIndex + 1, deckIndex], id: \.self) { absoluteIndex in
                    DeckCardFrame(
                        depth: absoluteIndex - deckIndex,
                        dragProgress: dragProgress,
                        dragOffset: dragOffset,
                        size: CGSize(width: geo.size.width, height: geo.size.height - 12),
                        gesture: gesture,
                        content: DeckCardContent(
                            entry: deck[absoluteIndex % deck.count],
                            isStartOfDeck: absoluteIndex == 0,
                            totalQuests: deck.count - 1,
                            generation: generation,
                            limits: limits,
                            actions: actions
                        )
                    )
                }
            }
        }
    }
}

/// A card's place-in-stack presentation: scaled and offset by depth,
/// the next card lifting toward full size as the top card drags, and
/// the drag transforms + swipe gesture applied to the top card only.
struct DeckCardFrame<SwipeGesture: Gesture>: View {
    /// How deep the card is comapred to the top card in the DeckStack
    let depth: Int
    
    /// -1…1, left…right.
    let dragProgress: CGFloat
    let dragOffset: CGSize
    let size: CGSize
    let gesture: SwipeGesture
    let content: DeckCardContent

    var body: some View {
        // The next card lifts toward full size as the top card is dragged
        // Applies to only the second card in the deck (depth 1)
        let lift = depth == 1 ? min(1, abs(dragProgress)) : 0 // how far has the second card (depth 1) risen toward taking the top spot (0->1). The size of the second card scales based off of the lift (more lift, more size increase). Lift for all other depth cards is always 0 (because they don't have to do anything with increasing their size when being swiped)
        let isTopCard = depth == 0

        let shadowStrength = Double(isTopCard ? 1 : lift) // shadow strength for cards calculated using their lift (for smooth transition to the second card) -> top card always has shadow of 1, depth 2 card will have 0 (as lift is 0), and the shadow for the second card will fade in when its lift is increasing

        content
            .frame(width: size.width, height: size.height)
            .background(
                RoundedRectangle(cornerRadius: 32)
                    .fill(Color("AppSurface"))
                    // two shadows to give it a convincing real-light effect
                    .shadow(color: .black.opacity(0.07 * shadowStrength), radius: 4, y: 3) // "key shadow"
                    .shadow(color: .black.opacity(0.16 * shadowStrength), radius: 22, y: 14) // "ambient shadow"
            )
            .scaleEffect(isTopCard ? 1 : 1 - 0.06 * CGFloat(depth) + 0.06 * lift) // logic to increase the size of the card at depth 1 gradually till it becomes to top card
            .offset(y: isTopCard ? 0 : CGFloat(depth) * 14 - lift * 14) // second cards sits 14 points lower at rest (and the third sits 28), resurfaces gradually when becomes topCard (note: origin (0,0) for SwiftUI is top left, and a positive value in y offset means downward translation. Cards don't leak from the bottom because they are scaled down based on their depth
            .opacity(depth == 2 ? 0.5 : 1)
            .offset(isTopCard ? dragOffset : .zero) // only top card translates (apply conditional instead of rendering a different variant of content so shadows are applied to all cards in the deck)
            .rotationEffect( // only top card rotates when being swiped (apply conditional instead of rendering a different variant of content so shadows are applied to all cards in the deck)
                .degrees(isTopCard ? Double(dragOffset.width / 18) : 0),
                anchor: .bottom
            )
            // .subviews keeps the card's own buttons alive but ignores
            // the swipe gesture unless this is the top card.
            .gesture(gesture, including: isTopCard ? .all : .subviews)
    }
}

/// What a deck slot renders: the base card, or one quest card.
/// Utilized by being placed inside a DeckCardFrame
struct DeckCardContent: View {
    let entry: DeckEntry
    let isStartOfDeck: Bool // only the first-ever card shows the base card's start form
    let totalQuests: Int
    let generation: GenerationStatus
    let limits: DailyActionStamps
    let actions: DeckActions

    var body: some View {
        switch entry {
        case .base:
            BaseCard(
                form: isStartOfDeck ? .start : .end,
                hasQuests: totalQuests > 0,
                isGenerating: generation.isRunning,
                generationCompleting: generation.isCompleting,
                curatedLast: limits.curatedLast,
                describedLast: limits.describedLast,
                onGenerate: actions.onGenerate,
                onDescribe: actions.onDescribe,
                onTuneProfile: actions.onTuneProfile
            )
        case .quest(let quest, let position):
            SwipeQuestCard(
                quest: quest,
                position: position,
                total: totalQuests,
                onPass: actions.onPass,
                onCommit: actions.onCommit
            )
        }
    }
}



/// tints the background to dispay a certain color (AppPrimary here)
struct DirectionTint: View {
    let strength: Double

    var body: some View {
        Color("AppPrimary")
            .opacity(strength)
            .ignoresSafeArea()
            .allowsHitTesting(false) // removes this view from being bothered by touches (redundant because the DeckStack sits on top of DirectionTint anyway. This is because in a ZStack, Views declared at the bottom sit on top of the touch order, which is where DeckStack sits in ExploreScreen's ZStack)
    }
}
