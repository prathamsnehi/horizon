//
//  ExploreScreen.swift
//  horizon
//
//  Tab 2 — the swipe deck. Left = not now (never destructive), right =
//  commit. Owns state and actions; the machinery is in DeckStack.swift.
//

import SwiftUI
import SwiftData

struct ExploreScreen: View {
    @Binding var selectedTab: MainTabView.AppTab

    @Environment(\.modelContext) private var modelContext
    @Query private var quests: [Quest]
    @Query private var profiles: [UserProfile]

    @State private var model = ExploreScreenModel()

    // ui-related states:
    @State private var deckIndex = 0
    @State private var dragOffset: CGSize = .zero // used to set the position of the cards in the deck when swiping (updated by gesture dragGesture down below)
    @State private var crossedThreshold = false // did a card cross the swipeThreshold? If so, prepare to take action according to left or right swipe
    @State private var pendingCommit: Quest?
    @State private var showDescribeSheet = false
    @State private var showSettingsSheet = false
    // Set when Settings confirms "Delete all data"; the wipe runs from the
    // sheet's onDismiss so the deleted profile isn't referenced mid-teardown.
    @State private var pendingReset = false

    private let swipeThreshold: CGFloat = 120

    /// Distance to translate a swiped card horizontally so that it sits outside the screen's viewport
    private var flyOutDistance: CGFloat { UIScreen.main.bounds.width * 1.5 }

    // MARK: Deck contents

    /// Sorting logic for cards belonging to available quests, sorted so that the first card is user-described
    private var feedQuests: [Quest] {
        quests
            .filter { $0.status == .available }
            .sorted {
                if ($0.origin == .described) != ($1.origin == .described) {
                    return $0.origin == .described // sorts to show the user-described quest as the first element
                }
                return $0.createdAt > $1.createdAt // newest first, so a fresh set leads the deck
            }
    }

    private var activeQuest: Quest? {
        quests.first { $0.status == .active }
    }

    /// The custom card a new describe would replace — newest, since a
    /// swapped-back described quest can leave an older one behind.
    private var newestDescribedCard: Quest? {
        quests
            .filter { $0.status == .available && $0.origin == .described }
            .max { $0.createdAt < $1.createdAt }
    }

    /// A deck of all the cards that will be swiped on (includes the base instructional card)
    private var deck: [DeckEntry] {
        [.base] + feedQuests.enumerated().map { .quest($1, position: $0 + 1) }
    }

    private func entry(at absoluteIndex: Int) -> DeckEntry {
        deck[absoluteIndex % deck.count]
    }

    /// The entry deckIndex points at — the card currently being seen by the user on top of the deck
    private var currentEntry: DeckEntry { entry(at: deckIndex) }

    private var isCurrentEntryBaseCard: Bool {
        if case .base = currentEntry { return true }
        return false
    }

    /// -1…1, left…right.
    private var dragProgress: CGFloat {
        max(-1, min(1, dragOffset.width / swipeThreshold))
    }

    // MARK: Body

    var body: some View {
        ZStack {
            AmbientBackground()
            
            // Warms with the brand color on a right-drag
            DirectionTint(strength: isCurrentEntryBaseCard ? 0 : Double(max(0, dragProgress)) * 0.08)
            
            // Swipable card deck interface
            DeckStack(
                deckIndex: deckIndex,
                deck: deck,
                dragProgress: dragProgress,
                dragOffset: dragOffset,
                gesture: dragGesture,
                // The onboarding-fired first generation counts too: a user
                // who outpaces the walkthrough sees the curating progress
                // here, not the daily actions (which would double-spend).
                generation: GenerationStatus(
                    isRunning: model.isGeneratingSet || FirstGenerationStatus.shared.isRunning,
                    isCompleting: model.setGenerationCompleting || FirstGenerationStatus.shared.isCompleting
                ),
                limits: DailyActionStamps(
                    curatedLast: profiles.first?.lastCuratedGenerationDate,
                    describedLast: profiles.first?.lastDescribedGenerationDate
                ),
                actions: DeckActions(
                    onGenerate: generateSet,
                    onDescribe: { showDescribeSheet = true },
                    onTuneProfile: { showSettingsSheet = true },
                    onPass: swipeLeft,
                    onCommit: swipeRight
                )
            )
            .padding(.horizontal, 20)
            .padding(.top, 28)
            .padding(.bottom, 28)

            // pendingCommit assigned as soon as a right swipe (show popup to confirm commit)
            if let quest = pendingCommit {
                CommitConfirmCard(
                    quest: quest,
                    hasActiveQuest: activeQuest != nil,
                    onCommit: { commit(quest) },
                    onCancel: cancelCommit
                )
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: pendingCommit != nil)
        .sensoryFeedback(.selection, trigger: crossedThreshold)
        // The onboarding-fired generation lands while the user may
        // already be watching the base card — reveal it like the
        // in-app generate action does.
        .onChange(of: FirstGenerationStatus.shared.insertedSetCount) {
            revealFirstQuest()
        }
        .sheet(isPresented: $showSettingsSheet, onDismiss: {
            // The sheet is fully gone now, so wiping (which flips
            // hasCompletedOnboarding and swaps the root to onboarding)
            // has no live view holding the deleted profile.
            if pendingReset {
                pendingReset = false
                LocalDataReset.wipe(context: modelContext)
            }
        }) {
            if let profile = profiles.first {
                SettingsScreen(profile: profile, onRequestReset: { pendingReset = true })
            }
        }
        .sheet(isPresented: $showDescribeSheet) {
            DescribeQuestScreen(
                model: model,
                profile: profiles.first,
                replacingQuestTitle: newestDescribedCard?.title,
                onCreated: {
                    // Reveal the fresh custom card — it sorts to the
                    // deck's front, right after the base card.
                    withAnimation(.spring(duration: 0.5)) {
                        deckIndex = 1
                        dragOffset = .zero
                    }
                }
            )
        }
        .alert(
            "Something went wrong",
            isPresented: Binding(
                get: { model.errorMessage != nil },
                set: { if !$0 { model.errorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(model.errorMessage ?? "")
        }
    }

    // MARK: Gesture

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in // fires constantly when finger is dragging card
                guard pendingCommit == nil else { return }
                dragOffset = value.translation // displacement done by finger, type: CGSize
                crossedThreshold = abs(value.translation.width) > swipeThreshold
            }
            .onEnded { value in // fires when the finger is lifted
                crossedThreshold = false
                let projected = value.predictedEndTranslation.width // emulate swiping out of the screen so that it feels as if the card was swiped by momentum of your finger

                if value.translation.width > swipeThreshold || projected > swipeThreshold * 2.5 { // if swiped far enough, or with enough velocity towards the right
                    swipeRight()
                } else if value.translation.width < -1 * swipeThreshold || projected < -1 * swipeThreshold * 2.5 { // if swiped far enough, or with enough velocity towards the right
                    swipeLeft()
                } else {
                    // weak dragging (not far enough or not enough velocity), reset the card to its position in the deck
                    withAnimation(.spring(response: 0.4, dampingFraction: 0.75)) {
                        dragOffset = .zero
                    }
                }
            }
    }

    // MARK: Swipe actions

    private func swipeLeft() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        flyOutAndAdvance(toX: -1 * flyOutDistance)
    }

    private func swipeRight() {
        if isCurrentEntryBaseCard {
            // if base card, right swipe just advances the cards
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            flyOutAndAdvance(toX: flyOutDistance)
        } else if case .quest(let quest, _) = currentEntry {
            // If a quest card, doing a right swipe means trying to commit to it
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) {
                dragOffset = CGSize(width: 340, height: dragOffset.height * 0.4)
                // not calling flyOutAndAdvance because that stricly means incrementing deckIndex (not want to do that since user can cancel commit and want to return back to same deckIndex)
            }
            pendingCommit = quest
        }
    }

    private func flyOutAndAdvance(toX x: CGFloat) {
        withAnimation(.easeOut(duration: 0.3)) {
            dragOffset = CGSize(width: x, height: dragOffset.height) // keep the height const but swoosh swipe animate the card towards left or right
        }
        Task {
            try? await Task.sleep(for: .milliseconds(150)) // this 150 ms figure is derived as follows: duration of animation is 0.3s, about half of that the card spends outside of the viewport, so bam 300ms/2 (not 300 exactly as less smooth)
            var transaction = Transaction()
            // pause animations for until the new variable values for deckIndex and dragOffset settle in
            // done to prevent abrupt changes to the UI
            transaction.disablesAnimations = true
            withTransaction(transaction) {
                // the transaction makes it so that deckIndex and dragOffset updates happen atomically (at once).
                // If one updates before the other, UI glitches happen as a lot of UI state depends on these two variables
                deckIndex += 1
                dragOffset = .zero
            }
        }
    }

    private func cancelCommit() {
        pendingCommit = nil
        withAnimation(.spring(response: 0.45, dampingFraction: 0.8)) {
            dragOffset = .zero
            // no change in deckIndex, so the canceled card comes flying back to place smoothly
        }
    }

    private func commit(_ quest: Quest) {
        quest.activate(replacing: activeQuest) // swaps the quests in place (switching, if there is an active quest)

        UINotificationFeedbackGenerator().notificationOccurred(.success) // give haptic
        pendingCommit = nil

        // The quest leaves the pool, so the deck re-derives; just reset.
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            dragOffset = .zero
        }
        selectedTab = .quest
    }

    // MARK: Generation

    private func generateSet() {
        guard let profile = profiles.first else { return }
        Task {
            let success = await model.generateCuratedSet(profile: profile, context: modelContext)
            if success {
                revealFirstQuest()
            }
        }
    }

    /// Moves the deck off the base card onto the first quest.
    private func revealFirstQuest() {
        guard !feedQuests.isEmpty else { return }
        withAnimation(.spring(duration: 0.5)) {
            deckIndex = 1
            dragOffset = .zero
        }
    }

}

#Preview {
    ExploreScreen(selectedTab: .constant(.explore))
        .modelContainer(PreviewSwiftData.container)
}
