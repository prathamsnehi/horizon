//
//  DescribeQuestScreen.swift
//  horizon
//
//  Modal sheet: describe the quest you want, the AI builds one card
//  from it. Always a live generation (~10–20s).
//

import SwiftUI
import SwiftData

struct DescribeQuestScreen: View {
    @Bindable var model: ExploreScreenModel
    let profile: UserProfile?
    /// Title of the unaccepted described card that a new generation
    /// would replace (Rule 2's single custom slot); nil when none.
    let replacingQuestTitle: String?
    /// Fires after a successful generation, before the sheet dismisses —
    /// the deck uses it to reveal the fresh custom card.
    let onCreated: () -> Void

    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var prompt = ""

    private let examplePrompts = [
        "live music tonight",
        "something with water",
        "meet someone new",
        "a hidden gem café"
    ]

    var body: some View {
        ZStack {
            AmbientBackground()

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Eyebrow(text: "Describe Your Own", color: Color("AppPrimary"))

                    Text("What kind of quest are you in the mood for?")
                        .font(.title2)
                        .fontWeight(.bold)
                        .foregroundStyle(Color("AppPrimaryText"))
                        // Never let a tight layout truncate the headline.
                        .fixedSize(horizontal: false, vertical: true)

                    TextField(
                        "Something with live music tonight…",
                        text: $prompt,
                        axis: .vertical
                    )
                    .font(.body)
                    .foregroundStyle(Color("AppPrimaryText"))
                    .lineLimit(3...6)
                    .padding(16)
                    .background(Color("AppSurface"), in: RoundedRectangle(cornerRadius: 16))
                    .disabled(model.isDescribing)
                    .characterLimit(ValidationLimits.describePromptChars, $prompt)

                    CharacterCounter(count: prompt.count, limit: ValidationLimits.describePromptChars)

                    FlowLayout(spacing: 8) {
                        ForEach(examplePrompts, id: \.self) { example in
                            Button {
                                prompt = example
                            } label: {
                                Text(example)
                                    .font(.caption)
                                    .lineLimit(1)
                                    .fixedSize()
                                    .foregroundStyle(Color("AppSecondaryText"))
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 7)
                                    .overlay(
                                        Capsule().strokeBorder(
                                            Color("AppSecondaryText").opacity(0.28),
                                            lineWidth: 1
                                        )
                                    )
                            }
                            .buttonStyle(PressableButtonStyle())
                            .disabled(model.isDescribing)
                        }
                    }

                    if let replacingQuestTitle, !model.isDescribing {
                        ReplaceSlotNotice(title: replacingQuestTitle)
                            .transition(.opacity)
                    }
                }
                .padding(28)
                .animation(.easeInOut(duration: 0.2), value: model.isDescribing)
            }
            .scrollDismissesKeyboard(.interactively)
            .scrollBounceBehavior(.basedOnSize)
        }
        // Pinned below the scrolling content so the keyboard lifts it
        // instead of burying it, and its height never squeezes the form.
        .safeAreaInset(edge: .bottom) {
            Group {
                if model.isDescribing {
                    CuratingProgressView(isComplete: model.describeCompleting)
                } else {
                    CreateQuestButton(
                        isDisabled: trimmedPrompt.isEmpty || profile == nil,
                        action: createQuest
                    )
                }
            }
            .padding(.horizontal, 28)
            .padding(.top, 24)
            .padding(.bottom, 12)
            .background(
                LinearGradient(
                    colors: [Color("AppBackground").opacity(0), Color("AppBackground")],
                    startPoint: .top,
                    endPoint: .bottom
                )
            )
            .animation(.easeInOut(duration: 0.2), value: model.isDescribing)
        }
        // A single detent: the form plus keyboard doesn't fit `.medium`,
        // and a detent change mid-edit is what made the sheet jump.
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(model.isDescribing)
    }

    private var trimmedPrompt: String {
        prompt.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func createQuest() {
        guard let profile else { return }
        let text = trimmedPrompt
        guard !text.isEmpty else { return }

        Task {
            let success = await model.describeQuest(
                prompt: text,
                profile: profile,
                context: modelContext
            )
            if success {
                onCreated()
                dismiss()
            }
        }
    }
}

/// Quiet inline warning: the deck holds one custom slot, so creating a
/// new described quest replaces the previous unaccepted one.
private struct ReplaceSlotNotice: View {
    let title: String

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.footnote)
                .foregroundStyle(Color("AppPrimary"))

            Text("Creating a new quest will replace your current custom quest — “\(title)”.")
                .font(.footnote)
                .foregroundStyle(Color("AppSecondaryText"))
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color("AppPrimary").opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct CreateQuestButton: View {
    let isDisabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: "wand.and.stars")
                Text("Create my quest")
            }
            .primaryCapsule(isEnabled: !isDisabled)
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(isDisabled)
    }
}
