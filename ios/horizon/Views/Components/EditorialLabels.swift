//
//  EditorialLabels.swift
//  horizon
//
//  The two tracked-out uppercase labels the app is typeset with: Eyebrow
//  above titles and sections, the smaller MicroLabel above a value.
//

import SwiftUI

/// Small tracked-out uppercase label used above titles and sections —
/// the editorial thread that runs through the app.
struct Eyebrow: View {
    let text: String
    var color: Color = Color("AppSecondaryText")
    /// Optional editorial index ("01", "02", …) shown before the label.
    var number: String? = nil

    var body: some View {
        HStack(spacing: 10) {
            if let number {
                Text(number)
                    .font(.caption)
                    .fontWeight(.bold)
                    .monospacedDigit()
                    .foregroundStyle(Color("AppPrimary"))
            }
            Text(text.uppercased())
                .font(.caption)
                .fontWeight(.semibold)
                .tracking(2.4)
                .foregroundStyle(color)
        }
    }
}

/// The smaller of the two: names a stat, a field, or a date without
/// competing with the value under it.
struct MicroLabel: View {
    let text: String
    /// Optional sentence-case line under the label, for a field whose
    /// name alone doesn't say what belongs in it. Kept inside the label
    /// rather than left to the call site so the two always sit as one
    /// group — the form VStacks around it space their children at 12.
    ///
    /// `.caption` and not `.footnote`: a hint must not outweigh the
    /// label it explains, and the label is `.caption2`. The uppercase
    /// tracking keeps them distinct across that 1pt.
    var hint: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(text.uppercased())
                .font(.caption2)
                .fontWeight(.medium)
                .tracking(1.5)
                .foregroundStyle(Color("AppSecondaryText"))

            if let hint {
                Text(hint)
                    .font(.caption)
                    .foregroundStyle(Color("AppSecondaryText"))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
