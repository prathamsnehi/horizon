//
//  CityPickerMap.swift
//  horizon
//
//  The city picker shared by onboarding and Settings: locality type-ahead
//  plus a map. Typed text alone never becomes the profile's city.
//

import SwiftUI
import MapKit

struct CityPickerMap: View {
    @Binding var selectedCity: SelectedCity?

    @State private var search = CitySearch()
    @State private var camera: MapCameraPosition = .automatic
    @FocusState private var searchFocused: Bool

    /// Shown the instant a city is tapped, while its coordinates resolve.
    @State private var pendingCityName: String?
    @State private var resolveTask: Task<Void, Never>?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if let name = selectedCity?.name ?? pendingCityName {
                SelectedCityChip(
                    name: name,
                    isResolving: selectedCity == nil,
                    onChange: clearSelection
                )
            } else {
                SearchField(
                    query: Binding(
                        get: { search.query },
                        set: { search.query = $0 }
                    ),
                    isFocused: $searchFocused
                )

                if !search.suggestions.isEmpty {
                    SuggestionList(
                        suggestions: Array(search.suggestions.prefix(4)),
                        onPick: pick
                    )
                }
            }

            if let city = selectedCity {
                CityMap(camera: $camera, city: city)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: selectedCity)
        .animation(.easeInOut(duration: 0.25), value: pendingCityName)
        .onAppear(perform: restoreCameraIfNeeded)
    }

    /// Selection lands immediately — the suggestion already carries the
    /// name; only the coordinates need the network.
    private func pick(_ completion: MKLocalSearchCompletion) {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        searchFocused = false
        pendingCityName = completion.title

        resolveTask?.cancel()
        resolveTask = Task {
            let resolved = await search.resolve(completion)
            guard !Task.isCancelled else { return }

            guard let resolved else {
                // Couldn't place it — drop back to the search field.
                pendingCityName = nil
                return
            }

            selectedCity = resolved
            pendingCityName = nil
            flyCamera(to: resolved.latitude, resolved.longitude)
        }
    }

    private func clearSelection() {
        resolveTask?.cancel()
        pendingCityName = nil
        selectedCity = nil
        search.query = ""
    }

    private func restoreCameraIfNeeded() {
        // Opening with a city already picked.
        if let city = selectedCity {
            flyCamera(to: city.latitude, city.longitude)
        }
    }

    private func flyCamera(to latitude: Double, _ longitude: Double) {
        withAnimation(.easeInOut(duration: 1.2)) {
            camera = .region(MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: latitude, longitude: longitude),
                span: MKCoordinateSpan(latitudeDelta: 0.35, longitudeDelta: 0.35)
            ))
        }
    }
}

// MARK: - Pieces

private struct SearchField: View {
    @Binding var query: String
    var isFocused: FocusState<Bool>.Binding

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Color("AppSecondaryText"))

            TextField("Search your city…", text: $query)
                .font(.body)
                .foregroundStyle(Color("AppPrimaryText"))
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .focused(isFocused)
        }
        .padding(16)
        .background(Color("AppSurface"), in: RoundedRectangle(cornerRadius: 16))
    }
}

private struct SuggestionList: View {
    let suggestions: [MKLocalSearchCompletion]
    let onPick: (MKLocalSearchCompletion) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(suggestions.enumerated()), id: \.offset) { index, suggestion in
                Button {
                    onPick(suggestion)
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(suggestion.title)
                            .font(.subheadline)
                            .fontWeight(.medium)
                            .foregroundStyle(Color("AppPrimaryText"))

                        if !suggestion.subtitle.isEmpty {
                            Text(suggestion.subtitle)
                                .font(.caption)
                                .foregroundStyle(Color("AppSecondaryText"))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 11)
                    .contentShape(Rectangle()) // whole row tappable, not just the text
                }
                .buttonStyle(PressableButtonStyle())

                if index < suggestions.count - 1 {
                    Divider()
                        .padding(.leading, 16)
                }
            }
        }
        .background(Color("AppSurface"), in: RoundedRectangle(cornerRadius: 16))
    }
}

private struct SelectedCityChip: View {
    let name: String
    /// Coordinates still resolving; the city itself is already chosen.
    var isResolving = false
    let onChange: () -> Void

    var body: some View {
        HStack(spacing: 10) {
            if isResolving {
                ProgressView()
                    .controlSize(.small)
                    .tint(Color("AppPrimary"))
            } else {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color("AppPrimary"))
            }

            Text(name)
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(Color("AppPrimaryText"))
                .lineLimit(1)

            Spacer()

            Button(action: onChange) {
                Text("Change")
                    .font(.footnote)
                    .fontWeight(.medium)
                    .foregroundStyle(Color("AppSecondaryText"))
                    .contentShape(Rectangle().inset(by: -10)) // hit target beyond the word
            }
            .buttonStyle(PressableButtonStyle())
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 13)
        .background(Color("AppPrimary").opacity(0.1), in: RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color("AppPrimary").opacity(0.5), lineWidth: 1)
        )
    }
}

private struct CityMap: View {
    @Binding var camera: MapCameraPosition
    let city: SelectedCity

    var body: some View {
        Map(position: $camera) {
            Annotation(city.name, coordinate: CLLocationCoordinate2D(
                latitude: city.latitude,
                longitude: city.longitude
            )) {
                CityBeacon()
            }
        }
        .frame(height: 220)
        .clipShape(RoundedRectangle(cornerRadius: 20))
    }
}

/// The pulsing AppPrimary beacon — same motif as the quest map.
private struct CityBeacon: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(Color("AppPrimary").opacity(0.35))
                .frame(width: 34, height: 34)
                .phaseAnimator([false, true]) { view, expanded in
                    view
                        .scaleEffect(expanded ? 1.5 : 0.8)
                        .opacity(expanded ? 0 : 0.9)
                } animation: { _ in
                    .easeOut(duration: 1.6)
                }

            Circle()
                .fill(Color("AppPrimary"))
                .frame(width: 13, height: 13)
                .overlay(Circle().strokeBorder(.white, lineWidth: 2))
        }
    }
}
