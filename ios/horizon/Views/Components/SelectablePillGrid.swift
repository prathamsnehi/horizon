//
//  SelectablePillGrid.swift
//  horizon
//
//  Multi-select pill grid: ghost pills that fill with an AppPrimary wash
//  when selected. CustomPillInput lets the user add their own.
//

import SwiftUI

struct SelectablePillGrid: View {
    let options: [String]
    let isSelected: (String) -> Bool
    let onToggle: (String) -> Void

    var body: some View {
        FlowLayout(spacing: 10) {
            ForEach(options, id: \.self) { option in
                SelectablePill(
                    label: option,
                    isSelected: isSelected(option),
                    onTap: { onToggle(option) }
                )
            }
        }
    }
}

struct SelectablePill: View {
    let label: String
    let isSelected: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            Text(label)
                .font(.footnote)
                .fontWeight(.medium)
                .lineLimit(1)
                .fixedSize()
                .foregroundStyle(isSelected ? Color("AppPrimaryText") : Color("AppSecondaryText"))
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(
                    Capsule().fill(isSelected ? Color("AppPrimary").opacity(0.22) : Color.clear)
                )
                .overlay(
                    Capsule().strokeBorder(
                        isSelected ? Color("AppPrimary") : Color("AppSecondaryText").opacity(0.28),
                        lineWidth: 1
                    )
                )
        }
        .buttonStyle(PressableButtonStyle())
        .sensoryFeedback(.selection, trigger: isSelected)
        .animation(.spring(response: 0.3, dampingFraction: 0.8), value: isSelected)
    }
}

/// A quiet inline "add your own" field that turns its text into a
/// new (selected) pill on submit.
struct CustomPillInput: View {
    let placeholder: String
    let onAdd: (String) -> Void

    @State private var text = ""

    private var trimmed: String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "plus")
                .font(.footnote)
                .foregroundStyle(Color("AppPrimary"))

            TextField(placeholder, text: $text)
                .font(.footnote)
                .foregroundStyle(Color("AppPrimaryText"))
                .submitLabel(.done)
                .onSubmit(add)
                .characterLimit(ValidationLimits.profileStringChars, $text)

            if !trimmed.isEmpty {
                Button(action: add) {
                    Image(systemName: "arrow.turn.down.left")
                        .font(.footnote)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color("AppPrimary"))
                }
                .buttonStyle(PressableButtonStyle())
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .background(
            Capsule().strokeBorder(
                Color("AppPrimary").opacity(trimmed.isEmpty ? 0.35 : 0.7),
                style: StrokeStyle(lineWidth: 1, dash: trimmed.isEmpty ? [4, 4] : [])
            )
        )
        .animation(.easeInOut(duration: 0.15), value: trimmed.isEmpty)
    }

    private func add() {
        guard !trimmed.isEmpty else { return }
        onAdd(trimmed)
        text = ""
    }
}
