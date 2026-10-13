import Foundation
import FoundationModels
import MapKit

// JSON-lines protocol. Source venue data stays in the caller's memory; this
// executable never reads credentials, persists provider data, or invokes PCC.
struct Request: Decodable {
    let operation: String
    let prompt: String?
    let query: String?
    let south: Double?
    let north: Double?
    let west: Double?
    let east: Double?
}

@Generable enum Difficulty: String, Codable { case easy, moderate, hard, extreme }
@Generable enum Transport: String, Codable { case walking, publicTransport, car, bike, rideshare }
@Generable struct WrittenQuest: Codable {
    var title: String
    var questDescription: String
    var difficulty: Difficulty
    var estimatedActivityMinutes: Int
    var categories: [String]
    var assignedLocationId: String
    var recommendedTransportationMode: Transport
    var locationDescription: String
    var pushesComfortZoneEdges: [String]
}
@Generable struct WrittenBatch: Codable {
    @Guide(.count(1)) var quests: [WrittenQuest]
}
@Generable struct NativeHealth: Codable { var ready: Bool }

@main struct HorizonEvaluation {
    @MainActor static func main() async {
        while let line = readLine() {
            let started = Date()
            do {
                let request = try JSONDecoder().decode(Request.self, from: Data(line.utf8))
                let value = try await execute(request)
                emit(["ok": true, "value": value, "latencyMs": Date().timeIntervalSince(started) * 1000])
            } catch {
                emit(["ok": false, "error": safeError(error),
                      "latencyMs": Date().timeIntervalSince(started) * 1000])
            }
        }
    }

    @MainActor static func execute(_ request: Request) async throws -> Any {
        switch request.operation {
        case "availability":
            return ["available": SystemLanguageModel.default.isAvailable,
                    "availability": String(describing: SystemLanguageModel.default.availability),
                    "model": "SystemLanguageModel.default",
                    "os": ProcessInfo.processInfo.operatingSystemVersionString]
        case "search":
            guard let query = request.query, let south = request.south,
                  let north = request.north, let west = request.west, let east = request.east,
                  south < north, west < east else { throw Failure.invalidRequest }
            let search = MKLocalSearch.Request()
            search.naturalLanguageQuery = query
            search.region = MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: (south + north) / 2, longitude: (west + east) / 2),
                span: MKCoordinateSpan(latitudeDelta: north - south, longitudeDelta: east - west))
            search.resultTypes = .pointOfInterest
            search.regionPriority = .required
            // Both adapters additionally apply the exact same bounds filter.
            let response = try await MKLocalSearch(request: search).start()
            return response.mapItems.filter {
                let point = $0.location.coordinate
                return point.latitude >= south && point.latitude <= north &&
                    point.longitude >= west && point.longitude <= east
            }.prefix(5).map { item -> [String: Any] in
                let point = item.location.coordinate
                return ["id": item.identifier?.rawValue ?? "",
                        "name": item.name ?? "",
                        "address": item.address?.fullAddress ?? item.addressRepresentations?.fullAddress(includingRegion: true, singleLine: true) ?? "",
                        "latitude": point.latitude, "longitude": point.longitude,
                        "website": item.url?.absoluteString ?? "",
                        "sourceURL": "https://maps.apple.com/?ll=\(point.latitude),\(point.longitude)"]
            }
        case "write":
            guard let prompt = request.prompt else { throw Failure.invalidRequest }
            guard SystemLanguageModel.default.isAvailable else { throw Failure.modelUnavailable }
            // One frozen adaptation: use the original Writer task, add evidence
            // boundaries, and let @Generable supply the compact output schema.
            let session = LanguageModelSession(model: SystemLanguageModel.default, instructions: """
                Write one real-world quest using only the supplied venue record.
                Return the requested structured fields. Never invent venue facts:
                Wi-Fi, outlets, prices, hours, seating, noise, classes, bookings,
                accessibility, and admission policies are unknown unless supplied.
                Preserve the user's requested activity. Do not add a social task
                to a deep-work session. Use the supplied location ID verbatim.
                """)
            let response = try await session.respond(to: prompt, generating: WrittenBatch.self,
                options: GenerationOptions(temperature: 0.3, maximumResponseTokens: 1200))
            return try JSONSerialization.jsonObject(with: JSONEncoder().encode(response.content))
        case "probe":
            guard SystemLanguageModel.default.isAvailable else { throw Failure.modelUnavailable }
            let session = LanguageModelSession(model: SystemLanguageModel.default)
            let response = try await session.respond(to: "Set ready to true.", generating: NativeHealth.self,
                options: GenerationOptions(temperature: 0, maximumResponseTokens: 32))
            return ["ready": response.content.ready]
        default: throw Failure.invalidRequest
        }
    }

    static func emit(_ value: [String: Any]) {
        do {
            let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
            print(String(decoding: data, as: UTF8.self))
            fflush(stdout)
        } catch { print("{\"ok\":false,\"error\":\"response_encoding_failed\"}") }
    }
    static func safeError(_ error: Error) -> String {
        // Never send associated debug context, prompts, or raw provider data.
        if #available(macOS 27.0, *), let generation = error as? LanguageModelError {
            switch generation {
            case .contextSizeExceeded: return "Native context limit exceeded"
            case .rateLimited: return "Native rate limited"
            case .guardrailViolation: return "Native guardrail rejection"
            case .refusal: return "Native model refusal"
            case .timeout: return "Native request timeout"
            default: return "Native generation unsupported or invalid"
            }
        }
        let nativeError = error as NSError
        if nativeError.domain == MKErrorDomain {
            if nativeError.code == MKError.Code.serverFailure.rawValue { return "MapKit network failure" }
            if nativeError.code == MKError.Code.loadingThrottled.rawValue { return "MapKit rate limited" }
            return "MapKit search failed"
        }
        if nativeError.domain == NSURLErrorDomain { return "Native network failure" }
        return "Native operation failed"
    }
    enum Failure: Error { case invalidRequest, modelUnavailable }
}
