//
//  HeroImageView.swift
//  horizon
//
//  Renders Quest.locationPhotoData — bytes embedded in the generation
//  response, no URL, no fetch. nil falls back to a bundled placeholder.
//

import SwiftUI

struct HeroImageView: View {
    /// The quest's stored photo bytes; nil → bundled placeholder.
    let photoData: Data?

    private static let placeholderAsset = "sunset-sample"

    private var image: Image {
        if let photoData, let decoded = PhotoCache.image(for: photoData) {
            Image(uiImage: decoded)
        } else {
            Image(Self.placeholderAsset)
        }
    }

    var body: some View {
        image
            .resizable()
            .scaledToFill()
            // Decorative place/quest imagery; the place name is text nearby.
            .accessibilityHidden(true)
    }
}
