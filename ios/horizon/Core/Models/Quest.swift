//
//  Quest.swift
//  horizon
//
//  Created by Pratham S on 6/18/26.
//

import Foundation
import SwiftData

// CloudKit mirroring note: every stored property carries an inline
// default (or is optional) and there are no unique constraints — both
// hard requirements of SwiftData's CloudKit-backed stores.
@Model
class Quest {
    // MARK: property declarations
    var id: UUID = UUID()
    var createdAt: Date = Date()
    var updatedAt: Date = Date()

    // Basic Information:
    var title: String = ""
    var questDescription: String = ""
    var difficulty: DifficultyRating = DifficultyRating.moderate
    var estimatedActivityMinutes: Int = 30
    var categories: [String] = []

    // Which of the user's comfortZoneEdges this quest was written to
    // push, in priority order (primary first — dense surfaces show only
    // the first). Empty on generic quests.
    var pushesComfortZoneEdges: [String] = []

    // Origin (client-side; not sent by backend):
    var origin: QuestOrigin = QuestOrigin.personalized
    var userPrompt: String? // the text the user typed, for .described quests only

    // Location-Based Properties:
    var locationInformation: LocationInformation?

    // Decoded once from the response's base64 (no URL, no re-fetch);
    // nil → bundled placeholder.
    @Attribute(.externalStorage) var locationPhotoData: Data?

    // Completion Properties:
    var status: QuestStatus = QuestStatus.available
    var acceptedAt: Date? // when the quest became .active; cleared on swap
    var completedAt: Date?
    var journalEntry: String?

    // JPEG bytes on the model so CloudKit mirroring carries them.
    @Attribute(.externalStorage) var journalPhotoData: [Data] = []

    init(
        title: String,
        questDescription: String,
        difficulty: DifficultyRating,
        estimatedActivityMinutes: Int,
        categories: [String],
        pushesComfortZoneEdges: [String] = [],
        origin: QuestOrigin = .personalized,
        userPrompt: String? = nil,
        locationInformation: LocationInformation? = nil,
        locationPhotoData: Data? = nil
    ) {
        self.id = UUID()
        self.title = title
        self.questDescription = questDescription
        self.difficulty = difficulty
        self.estimatedActivityMinutes = estimatedActivityMinutes
        self.categories = categories
        self.pushesComfortZoneEdges = pushesComfortZoneEdges
        self.origin = origin
        self.userPrompt = userPrompt
        self.locationInformation = locationInformation
        self.locationPhotoData = locationPhotoData
        self.createdAt = Date()
        self.updatedAt = Date()
    }

    // MARK: status transitions

    /// Makes this quest the single active one, returning any currently
    /// active quest to the deck.
    func activate(replacing current: Quest?) {
        current?.returnToDeck()
        status = .active
        acceptedAt = .now
        updatedAt = .now
    }

    /// Puts the quest back in the deck (swap, or clearing the old
    /// active on a new commit).
    func returnToDeck() {
        status = .available
        acceptedAt = nil
        updatedAt = .now
    }

    /// Finalizes the quest into the logbook with its journal and photos.
    func markCompleted(journal: String?, photoData: [Data]) {
        journalPhotoData = photoData
        journalEntry = journal
        completedAt = .now
        status = .completed
        updatedAt = .now
    }

    // MARK: logbook edits

    func addJournalPhoto(_ data: Data) {
        journalPhotoData.append(data)
        updatedAt = .now
    }

    func removeJournalPhoto(at index: Int) {
        guard journalPhotoData.indices.contains(index) else { return }
        journalPhotoData.remove(at: index)
        updatedAt = .now
    }

    func updateJournalEntry(_ text: String?) {
        journalEntry = text
        updatedAt = .now
    }
}

// MARK: additional structs and properties
struct TransportationOption: Codable {
    let mode: TransportationMode
    let estimatedTravelMinutes: Int
    let isRecommended: Bool
}

struct LocationInformation: Codable {
    let name: String
    let address: String
    let locationDescription: String
    let latitude: Double
    let longitude: Double
    let googleMapsURL: String
    let distanceMiles: Double?
    let transportationOptions: [TransportationOption]

    // Wire-only: decoded into Quest.locationPhotoData on receipt, then
    // nilled so the bytes aren't stored twice.
    var photoImageBase64: String? = nil
    var photoContentType: String? = nil
}

enum DifficultyRating: String, Codable, CaseIterable {
    case easy
    case moderate
    case hard
    case extreme
}

enum QuestOrigin: String, Codable, CaseIterable {
    case personalized // came from a generated personalized set
    case described // built from a free-text prompt the user wrote
}

enum QuestStatus: String, Codable {
    case available // in the deck, not committed to yet (left swipe never changes status)
    case active // swiped right on this card, this is the only one active
    case completed // goes in the logbook permanently, all other are temp
}
