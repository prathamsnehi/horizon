//
//  PreviewSwiftData.swift
//  horizon
//
//  In-memory SwiftData container for previews, seeded verbatim from a
//  real generateCuratedQuests response (2026-07-03, Minneapolis).
//

import Foundation
import SwiftData
import UIKit

@MainActor
enum PreviewSwiftData {
    static let container: ModelContainer = {
        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        let container: ModelContainer
        do {
            container = try ModelContainer(
                for: Quest.self, UserProfile.self,
                configurations: config
            )
        } catch {
            fatalError("Could not create preview ModelContainer: \(error)")
        }
        seed(into: container.mainContext)
        return container
    }()

    private static func seed(into context: ModelContext) {
        // Real responses embed photo bytes (no URL); previews stand in
        // with bundled assets encoded the same way.
        func bundledPhotoData(_ assetName: String) -> Data? {
            UIImage(named: assetName)?.jpegData(compressionQuality: 0.9)
        }

        let coffeeQuest = Quest(
            title: "The Coffee Connoisseur Challenge",
            questDescription: "Visit Wildflyer Coffee and try their most unique or seasonal coffee drink. Strike up a conversation with the barista as well.",
            difficulty: .moderate,
            estimatedActivityMinutes: 45,
            categories: ["Coffee shops", "Meeting new people", "Trying new foods", "Photography"],
            pushesComfortZoneEdges: ["Talking to strangers", "Trying unfamiliar food"],
            origin: .personalized,
            locationInformation: LocationInformation(
                name: "Wildflyer Coffee",
                address: "3262 Minnehaha Ave, Minneapolis, MN 55406, USA",
                locationDescription: "",
                latitude: 44.943082399999994,
                longitude: -93.2307763,
                googleMapsURL: "https://maps.google.com/?cid=7505635957835105626&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA",
                distanceMiles: 3,
                transportationOptions: [
                    TransportationOption(mode: .walking, estimatedTravelMinutes: 60, isRecommended: false),
                    TransportationOption(mode: .publicTransport, estimatedTravelMinutes: 22, isRecommended: false),
                    TransportationOption(mode: .rideshare, estimatedTravelMinutes: 10, isRecommended: true)
                ]
            ),
            locationPhotoData: bundledPhotoData("sunset-sample")
        )
        // Marked active (not part of the server payload) so Quest tab
        // previews have a quest to render.
        coffeeQuest.status = .active
        coffeeQuest.acceptedAt = .now

        let foodHallQuest = Quest(
            title: "Global Food Explorer at Graze",
            questDescription: "Head to Graze Food Hall and challenge yourself to try a dish from a cuisine you’ve never experienced before. Engage with at least one vendor to learn about the cultural significance of their dish. Take a photo of your meal and note the flavors you enjoyed most.",
            difficulty: .easy,
            estimatedActivityMinutes: 60,
            categories: ["Food & cooking", "Trying new foods", "Meeting new people"],
            pushesComfortZoneEdges: ["Trying unfamiliar food"],
            origin: .personalized,
            locationInformation: LocationInformation(
                name: "Graze Food Hall by Travail",
                address: "520 N 4th St, Minneapolis, MN 55401, USA",
                locationDescription: "Industrial-style marketplace offering an eclectic array of food stands, plus cocktails, wine & beer.",
                latitude: 44.9849791,
                longitude: -93.2771777,
                googleMapsURL: "https://maps.google.com/?cid=13499694463761510348&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA",
                distanceMiles: 0.7,
                transportationOptions: [
                    TransportationOption(mode: .walking, estimatedTravelMinutes: 14, isRecommended: true),
                    TransportationOption(mode: .publicTransport, estimatedTravelMinutes: 13, isRecommended: false),
                    TransportationOption(mode: .rideshare, estimatedTravelMinutes: 6, isRecommended: false)
                ]
            ),
            locationPhotoData: bundledPhotoData("cafe-sample")
        )

        let creekQuest = Quest(
            title: "Minnehaha Creek Nature & Fitness Adventure",
            questDescription: "Explore Minnehaha Creek Park by completing a 3-mile hike or trail run along the creek. Stop at three scenic spots to take nature photographs, focusing on capturing the interplay of light and water. Reflect on how the outdoor activity makes you feel and jot down one new observation about the environment.",
            difficulty: .hard,
            estimatedActivityMinutes: 90,
            categories: ["Nature", "Fitness", "Photography", "Getting outdoors more", "Physical challenge"],
            origin: .personalized,
            locationInformation: LocationInformation(
                name: "Minnehaha Creek Park",
                address: "4600 S 32nd Ave, Minneapolis, MN 55406, USA",
                locationDescription: "",
                latitude: 44.9175766,
                longitude: -93.22474319999999,
                googleMapsURL: "https://maps.google.com/?cid=3248284329334202937&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA",
                distanceMiles: 4.7,
                transportationOptions: [
                    TransportationOption(mode: .walking, estimatedTravelMinutes: 94, isRecommended: false),
                    TransportationOption(mode: .publicTransport, estimatedTravelMinutes: 29, isRecommended: false),
                    TransportationOption(mode: .rideshare, estimatedTravelMinutes: 12, isRecommended: true)
                ]
            ),
            locationPhotoData: bundledPhotoData("sunset-sample")
        )

        context.insert(coffeeQuest)
        context.insert(foodHallQuest)
        context.insert(creekQuest)
    }
}
