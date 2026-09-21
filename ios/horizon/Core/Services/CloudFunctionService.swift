//
//  CloudFunctionService.swift
//  horizon
//
//  All Cloud Function calls via the typed Callable API; the request and
//  response structs are the wire contract. See docs/architecture/03.
//

import Foundation
import FirebaseAuth
import FirebaseFunctions

// MARK: - Request payloads (client-owned contract)

/// The wire shape of the user's profile — the frontend-owned contract the
/// backend accepts. A deliberate subset of `UserProfile`: persistence-only
/// fields (id, timestamps, daily-limit stamps, onboarding flag) never
/// leave the device. `nil` optionals are omitted from the encoded JSON.
struct ProfilePayload: Encodable {
    let interests: [String]
    let comfortZoneEdges: [String]
    let vibe: [String] // wire key stays singular — backend contract
    let experimentationLevel: Int
    let budget: [BudgetLevel]
    let transportation: [TransportationMode]
    let locationPreferences: [LocationPreference]
    let additionalContext: String?
    let city: String
    let cityLatitude: Double?
    let cityLongitude: Double?

    init(_ profile: UserProfile) {
        interests = profile.interests
        comfortZoneEdges = profile.comfortZoneEdges
        vibe = profile.vibes
        experimentationLevel = profile.experimentationLevel
        budget = profile.budget
        transportation = profile.transportation
        locationPreferences = profile.locationPreferences
        additionalContext = profile.additionalContext
        city = profile.city
        cityLatitude = profile.cityLatitude
        cityLongitude = profile.cityLongitude
    }
}

private struct CuratedQuestsRequest: Encodable {
    let profile: ProfilePayload
    let excludeTitles: [String]
}

private struct DescribedQuestRequest: Encodable {
    let prompt: String
    let profile: ProfilePayload
}

// MARK: - Response payloads (server contract)

struct QuestPayload: Decodable {
    let title: String
    let questDescription: String
    let difficulty: DifficultyRating
    let estimatedActivityMinutes: Int
    let categories: [String]
    /// Priority order, primary first. Absent on generic quests.
    let pushesComfortZoneEdges: [String]?
    let locationInformation: LocationInformation?

    func makeQuest(origin: QuestOrigin, userPrompt: String? = nil) -> Quest {
        // Decode the embedded place photo once, here at receipt; the
        // base64 string is stripped so only the Data persists (as
        // Quest.locationPhotoData, externalStorage) — never both.
        var location = locationInformation
        let photoData = location?.photoImageBase64.flatMap { Data(base64Encoded: $0) }
        location?.photoImageBase64 = nil
        location?.photoContentType = nil

        return Quest(
            title: title,
            questDescription: questDescription,
            difficulty: difficulty,
            estimatedActivityMinutes: estimatedActivityMinutes,
            categories: categories,
            pushesComfortZoneEdges: pushesComfortZoneEdges ?? [],
            origin: origin,
            userPrompt: userPrompt,
            locationInformation: location,
            locationPhotoData: photoData
        )
    }
}

private struct CuratedQuestsResponse: Decodable {
    let quests: [QuestPayload]
}

private struct DescribedQuestResponse: Decodable {
    let quest: QuestPayload
}

// MARK: - Errors

enum CloudFunctionError: LocalizedError {
    case offline
    case invalidArgument(String)
    case serverError(String)
    case malformedResponse
    case rateLimited(retryAt: Date?) // User already generated: gate opens again @ retryAt: Date?
    case timedOut // Server timeout, not user's fault (no penalize, only make wait for ~1.5 min)

    var errorDescription: String? {
        switch self {
        case .offline:
            "You're offline. Connect to the internet to generate quests."
        case .invalidArgument(let message):
            message.isEmpty ? "The request was rejected." : message
        case .serverError(let message):
            message.isEmpty ? "Generation failed. Please try again." : message
        case .malformedResponse:
            "Received an unexpected response. Please try again."
        case .rateLimited:
            "You've used today's quest. Come back tomorrow."
        case .timedOut:
            "Generation took too long. Give it a minute or two and try again — your daily quest wasn't used."
        }
    }
}

// MARK: - Service

final class CloudFunctionService {
    private let functions = Functions.functions()

    /// Curated set — cache-first on the backend; set size is server-controlled.
    func generateCuratedQuests(
        profile: UserProfile,
        excludeTitles: [String]
    ) async throws -> [QuestPayload] {
        let request = CuratedQuestsRequest(
            profile: ProfilePayload(profile),
            excludeTitles: Array(excludeTitles.prefix(ValidationLimits.excludeTitles))
        )
        let response: CuratedQuestsResponse = try await call("generateCuratedQuests", with: request)
        return response.quests
    }

    /// One quest from a freeform prompt — always live (~10–20s).
    func generateUserDescribedQuest(
        prompt: String,
        profile: UserProfile
    ) async throws -> QuestPayload {
        let request = DescribedQuestRequest(
            prompt: prompt,
            profile: ProfilePayload(profile)
        )
        let response: DescribedQuestResponse = try await call("generateUserDescribedQuest", with: request)
        return response.quest
    }

    // MARK: Transport

    private func call<Request: Encodable, Response: Decodable>(
        _ name: String,
        with request: Request
    ) async throws -> Response {
        // The backend rejects an unauthenticated call, so the session
        // comes first. Cheap after the first launch (keychain-persisted),
        // and its failures fall through the same mapping below — offline
        // here reads as offline to the caller.
        do {
            try await AnonymousSession.shared.ensure()
        } catch {
            throw Self.mapped(error)
        }

        var callable: Callable<Request, Response> = functions.httpsCallable(name)
        // Margin above the functions' own 60s timeout, so a slow-but-
        // successful generation is never abandoned client-side.
        callable.timeoutInterval = 90
        do {
            return try await callable.call(request)
        } catch is DecodingError {
            throw CloudFunctionError.malformedResponse
        } catch {
            throw Self.mapped(error)
        }
    }

    /// Everything the transport can throw, in the app's own vocabulary.
    /// Shared by the callable and the session that precedes it — a
    /// dropped connection reads the same either way.
    private static func mapped(_ error: Error) -> CloudFunctionError {
        let nsError = error as NSError

        if nsError.domain == NSURLErrorDomain {
            return nsError.code == NSURLErrorTimedOut ? .timedOut : .offline
        }

        // Auth doesn't surface URL errors directly — a sign-in with no
        // connection arrives as FIRAuthErrorDomain/networkError, and the
        // user should read that as offline like any other lost call.
        if nsError.domain == AuthErrorDomain,
           AuthErrorCode(rawValue: nsError.code) == .networkError {
            return .offline
        }

        if nsError.domain == FunctionsErrorDomain {
            let message = nsError.localizedDescription
            switch FunctionsErrorCode(rawValue: nsError.code) {
            case .invalidArgument: return .invalidArgument(message)
            case .resourceExhausted: return .rateLimited(retryAt: retryAt(from: nsError))
            case .deadlineExceeded: return .timedOut
            default: return .serverError(message)
            }
        }

        return .serverError(error.localizedDescription)
    }

    /// Pulls `details.retryAt` (ISO8601) off a Functions error, if present.
    private static func retryAt(from error: NSError) -> Date? {
        guard
            let details = error.userInfo[FunctionsErrorDetailsKey] as? [String: Any],
            let iso = details["retryAt"] as? String
        else { return nil }
        return ISO8601DateFormatter().date(from: iso)
    }
}
