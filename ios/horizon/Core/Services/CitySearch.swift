//
//  CitySearch.swift
//  horizon
//
//  Type-ahead city lookup: MKLocalSearchCompleter filtered to localities,
//  resolved to exact coords. Free text never becomes a profile city.
//

import Foundation
import MapKit

@Observable
@MainActor
final class CitySearch: NSObject, MKLocalSearchCompleterDelegate {

    /// Bind the search field to this; suggestions update as it changes.
    var query = "" {
        didSet { completer.queryFragment = query }
    }

    private(set) var suggestions: [MKLocalSearchCompletion] = []

    @ObservationIgnored
    private let completer = MKLocalSearchCompleter()

    override init() {
        super.init()
        completer.delegate = self
        completer.resultTypes = .address
        completer.addressFilter = MKAddressFilter(including: .locality)
    }

    // MKLocalSearchCompleter calls its delegate on the main queue.
    nonisolated func completerDidUpdateResults(_ completer: MKLocalSearchCompleter) {
        MainActor.assumeIsolated {
            suggestions = completer.results
        }
    }

    nonisolated func completer(_ completer: MKLocalSearchCompleter, didFailWithError error: Error) {
        MainActor.assumeIsolated {
            suggestions = []
        }
    }

    // MARK: Resolution

    /// Resolves a picked suggestion into a display name + exact coords.
    func resolve(_ completion: MKLocalSearchCompletion) async -> SelectedCity? {
        let search = MKLocalSearch(request: MKLocalSearch.Request(completion: completion))
        guard let item = try? await search.start().mapItems.first else { return nil }

        let coordinate = item.placemark.coordinate
        return SelectedCity(
            name: completion.title, // the disambiguated form, e.g. "St. Paul, MN"
            latitude: coordinate.latitude,
            longitude: coordinate.longitude
        )
    }
}

/// A city picked from the locality suggestions — the name is the
/// disambiguated form ("St. Paul, MN") and the coordinates are exact,
/// so ambiguous names can never geocode to the wrong place. Shared by
/// onboarding's Ground step and Settings.
struct SelectedCity: Equatable {
    let name: String
    let latitude: Double
    let longitude: Double
}
