//
//  CharacterLimit.swift
//  horizon
//
//  Enforcement + feedback for the text caps in ValidationLimits: a modifier
//  that clamps as the user types, and a counter that appears near the cap.
//

import SwiftUI

extension View {
    /// Clamps a bound text field to `limit` characters as it changes, so
    /// the client never submits past the backend's cap.
    func characterLimit(_ limit: Int, _ text: Binding<String>) -> some View {
        onChange(of: text.wrappedValue) { _, newValue in
            if newValue.count > limit {
                text.wrappedValue = String(newValue.prefix(limit))
            }
        }
    }
}

/// A right-aligned "n/limit" that only appears as the field nears its
/// cap — feedback without persistent clutter.
struct CharacterCounter: View {
    let count: Int
    let limit: Int

    private var threshold: Int { limit - 40 }

    var body: some View {
        Group {
            if count > threshold {
                Text("\(count)/\(limit)")
                    .font(.caption2)
                    .fontWeight(.medium)
                    .monospacedDigit()
                    .foregroundStyle(count >= limit ? Color("AppPrimary") : Color("AppSecondaryText"))
            }
        }
        .frame(maxWidth: .infinity, alignment: .trailing)
    }
}
