//
//  CompletionFlowScreen.swift
//  horizon
//
//  Single-page completion form: photo evidence + an optional journal entry.
//  Only submitting marks the quest .completed; closing leaves it active.
//

import SwiftUI

struct CompletionFlowScreen: View {
    let quest: Quest
    /// Called after the quest has been marked .completed.
    let onCompleted: () -> Void
    /// Closes the cover without completing — the quest stays active.
    let onClose: () -> Void

    @State private var model = CompletionFlowModel()

    var body: some View {
        ZStack {
            AmbientBackground()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 28) {
                    CompletionFlowHeader(questTitle: quest.title)

                    CompletionPhotoSection(model: model)
                        .elevatedCard()

                    JournalSection(text: $model.journalText)
                        .elevatedCard()

                    CompletionFlowButton(canComplete: model.canComplete, completionAction: submit)
                }
                .padding(24)
                .padding(.bottom, 24)
            }
        }
        .overlay(alignment: .topTrailing) {
            // Static circle, not interactive glass — the glass's own
            // touch handling can swallow the tap so the Button's action
            // never fires (press animation plays, nothing happens).
            Button {
                onClose()
            } label: {
                Image(systemName: "xmark")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(Color("AppPrimaryText"))
                    .padding(12)
                    .background(Color("AppSurface"), in: Circle())
                    .overlay(
                        Circle().strokeBorder(Color("AppSecondaryText").opacity(0.25), lineWidth: 1)
                    )
                    .contentShape(Circle())
            }
            .buttonStyle(PressableButtonStyle())
            .accessibilityLabel("Close")
            .padding(.trailing, 20)
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
    
    /// submits the quest logbook entry (saves it to SwiftData via the ViewModel)
    private func submit() {
        guard model.complete(quest: quest) else { return }
        onCompleted()
    }
}

// MARK: sub-components used within the CompletionFlowScreen
private struct CompletionFlowHeader: View {
    var questTitle: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow(text: "Quest Complete", color: Color("AppPrimary"))

            Text("Set it in memory.")
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundStyle(Color("AppPrimaryText"))

            Text(questTitle)
                .font(.subheadline)
                .foregroundStyle(Color("AppSecondaryText"))
        }
        .padding(.top, 28)
        .padding(.trailing, 44) // clear of the close button
    }
}

private struct CompletionFlowButton: View {
    let canComplete: Bool
    let completionAction: () -> Void
    
    var body: some View {
        Button(action: completionAction) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark.seal.fill")
                Text("Complete quest")
            }
            .primaryCapsule(isEnabled: canComplete)
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(!canComplete)
    }
}

private struct JournalSection: View {
    @Binding var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Eyebrow(text: "The Story", color: Color("AppPrimary"), number: "02")

            TextField(
                "How was it? (optional)",
                text: $text,
                axis: .vertical
            )
            .font(.body)
            .foregroundStyle(Color("AppPrimaryText"))
            .lineLimit(4...10)
        }
    }
}

#Preview {
    CompletionFlowScreen(
        quest: Quest(
            title: "Golden-Hour Photo Walk",
            questDescription: "Chase the last light along the river.",
            difficulty: .moderate,
            estimatedActivityMinutes: 60,
            categories: ["outdoors"]
        ),
        onCompleted: {},
        onClose: {}
    )
}
