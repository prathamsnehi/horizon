//
//  PhotoControls.swift
//  horizon
//
//  The two pieces the completion form and the logbook gallery share: a
//  square thumbnail with an optional remove badge, and a source capsule.
//

import SwiftUI

/// Square photo thumbnail. Pass `onRemove: nil` to hide the ✕ badge.
struct RemovablePhotoThumbnail: View {
    let image: UIImage
    let onRemove: (() -> Void)?

    var body: some View {
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            }
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .accessibilityElement()
            .accessibilityLabel("Photo")
            .overlay(alignment: .topTrailing) {
                if let onRemove {
                    Button(action: onRemove) {
                        Image(systemName: "xmark")
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundStyle(.white)
                            .padding(6)
                            .background(.black.opacity(0.55), in: Circle())
                    }
                    .padding(6)
                    .accessibilityLabel("Remove photo")
                }
            }
    }
}

/// "Library" / "Take photo" — a stroked capsule label. Not a Button
/// itself, because one of its two uses is a `PhotosPicker`'s label.
struct PhotoSourceLabel: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
            Text(text)
        }
        .font(.subheadline)
        .fontWeight(.medium)
        .foregroundStyle(Color("AppPrimaryText"))
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            Capsule().strokeBorder(Color("AppSecondaryText").opacity(0.35), lineWidth: 1)
        )
    }
}
