//
//  ProfilePillField.swift
//  horizon
//
//  The two labelled pill fields the profile is built from — free-form lists
//  and preset-only enums — so a field can't be presented two ways.
//

import SwiftUI

/// A free-form list field: label, optional hint, the preset pills plus
/// any customs, and the "add your own" input.
struct ProfilePillField: View {
    /// Nil where a section header already names the field.
    var label: String? = nil
    var hint: String? = nil
    let presets: [String]
    let selected: [String]
    let placeholder: String
    let onToggle: (String) -> Void
    let onAdd: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let label {
                MicroLabel(text: label, hint: hint)
            }

            SelectablePillGrid(
                options: ProfileVocabulary.pillOptions(presets: presets, selected: selected),
                isSelected: { selected.contains($0) },
                onToggle: onToggle
            )

            CustomPillInput(placeholder: placeholder, onAdd: onAdd)
        }
    }
}

/// A preset-only field: every case of the enum as a pill. Values are
/// carried through as values, never round-tripped through `displayName`.
struct EnumPillField<Value: PillDisplayable>: View {
    let label: String
    let selected: [Value]
    let onToggle: (Value) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            MicroLabel(text: label)

            FlowLayout(spacing: 10) {
                ForEach(Array(Value.allCases), id: \.self) { value in
                    SelectablePill(
                        label: value.displayName,
                        isSelected: selected.contains(value),
                        onTap: { onToggle(value) }
                    )
                }
            }
        }
    }
}
