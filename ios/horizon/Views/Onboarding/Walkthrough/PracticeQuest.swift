//
//  PracticeQuest.swift
//  horizon
//
//  The two quests the walkthrough's practice cards are built on. Never
//  inserted into the model context — swiping them commits nothing.
//

import SwiftUI
import UIKit

enum PracticeQuest {
    /// Real quests carry embedded photo bytes, so the practice cards do
    /// too — encoded once from a bundled asset.
    private static func bundledPhotoData(_ assetName: String) -> Data? {
        UIImage(named: assetName)?.jpegData(compressionQuality: 0.9)
    }

    static func passCard() -> Quest {
        Quest(
            title: "Chase the Golden Hour",
            questDescription: "Find a west-facing overlook near the Hidden Falls Overlook and watch the day end properly — no phone, except for one photo at the peak.",
            difficulty: .easy,
            estimatedActivityMinutes: 45,
            categories: ["Nature", "Mindfulness"],
            origin: .personalized,
            locationInformation: LocationInformation(
                name: "Hidden Falls Overlook",
                address: "A short walk from anywhere",
                locationDescription: "A quiet riverside overlook locals keep to themselves.",
                latitude: 0,
                longitude: 0,
                googleMapsURL: "",
                distanceMiles: 1.2,
                transportationOptions: []
            ),
            locationPhotoData: bundledPhotoData("sample-image-1")
        )
    }

    static func commitCard() -> Quest {
        Quest(
            title: "Order the Mystery Special",
            questDescription: "Walk into The Corner Roastery and ask the barista to surprise you. Drink whatever arrives.",
            difficulty: .moderate,
            estimatedActivityMinutes: 30,
            categories: ["Coffee shops", "Spontaneity"],
            pushesComfortZoneEdges: ["Talking to strangers"],
            origin: .personalized,
            locationInformation: LocationInformation(
                name: "The Corner Roastery",
                address: "Two streets from your usual",
                locationDescription: "Small-batch roaster with a counter full of strangers to meet.",
                latitude: 0,
                longitude: 0,
                googleMapsURL: "",
                distanceMiles: 0.8,
                transportationOptions: []
            ),
            locationPhotoData: bundledPhotoData("cafe-sample")
        )
    }
}
