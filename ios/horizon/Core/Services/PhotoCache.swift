//
//  PhotoCache.swift
//  horizon
//
//  Decoded photos, so a re-running SwiftUI body doesn't re-decode the same
//  bytes — Explore's body re-evaluates on every frame of a card drag.
//

import UIKit

enum PhotoCache {
    private static let cache: NSCache<NSData, UIImage> = {
        let cache = NSCache<NSData, UIImage>()
        cache.totalCostLimit = 64 * 1024 * 1024
        return cache
    }()

    /// The decoded image for these bytes, or nil if they aren't an image.
    static func image(for data: Data) -> UIImage? {
        let key = data as NSData
        if let cached = cache.object(forKey: key) { return cached }
        guard let image = UIImage(data: data) else { return nil }
        cache.setObject(image, forKey: key, cost: data.count)
        return image
    }
}
