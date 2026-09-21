//
//  CompletedStorySection.swift
//  horizon
//
//  The journal entry. Plain text by default; a field in Edit mode, which
//  SwiftData autosaves as the user types. An empty entry stores as nil.
//

import SwiftUI

struct CompletedStorySection: View {
    @Bindable var quest: Quest
    let isEditing: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Eyebrow(text: "The Story", color: Color("AppPrimary"), number: "02")

            if isEditing {
                // Boxed and tinted so the field reads as editable,
                // in contrast to the plain read-only text.
                TextField("How was it?", text: journalBinding, axis: .vertical)
                    .font(.body)
                    .foregroundStyle(Color("AppPrimaryText"))
                    .lineLimit(3...20)
                    .padding(14)
                    .background(Color("AppBackground").opacity(0.6), in: RoundedRectangle(cornerRadius: 14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(Color("AppPrimary").opacity(0.45), lineWidth: 1)
                    )
            } else if let journal = quest.journalEntry {
                Text(journal)
                    .font(.body)
                    .lineSpacing(5)
                    .foregroundStyle(Color("AppPrimaryText"))
            } else {
                Text("No journal entry yet — tap Edit to write one.")
                    .font(.subheadline)
                    .italic()
                    .foregroundStyle(Color("AppSecondaryText"))
            }
        }
    }

    private var journalBinding: Binding<String> {
        Binding(
            get: { quest.journalEntry ?? "" },
            set: { newValue in
                let trimmed = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
                quest.updateJournalEntry(trimmed.isEmpty ? nil : newValue)
            }
        )
    }
}
