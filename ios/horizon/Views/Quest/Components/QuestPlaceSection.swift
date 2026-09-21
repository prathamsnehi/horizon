import SwiftUI
import MapKit

// MARK: - QuestPlaceSection
struct QuestPlaceSection: View {
    let location: LocationInformation

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Eyebrow(text: "The Place", number: "02")

            VStack(alignment: .leading, spacing: 3) {
                Text(location.name)
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundStyle(Color("AppPrimaryText"))
                Text(location.address)
                    .font(.footnote)
                    .foregroundStyle(Color("AppSecondaryText"))
            }

            QuestTrailDivider(location: location)
                .padding(.vertical, 4)
                // Decorative animated trail; the distance/time it shows is
                // also read by the transport chips below.
                .accessibilityHidden(true)

            QuestMapCard(location: location)

            QuestTransportOptions(options: location.transportationOptions)
                .padding(.top, 4)

            if !location.locationDescription.isEmpty {
                Text(location.locationDescription)
                    .font(.subheadline)
                    .italic()
                    .foregroundStyle(Color("AppSecondaryText"))
                    .padding(.leading, 13)
                    .overlay(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 1.5)
                            .fill(Color("AppPrimary"))
                            .frame(width: 3)
                    }
            }
        }
    }
}

// MARK: - QuestMapCard
struct QuestMapCard: View {
    let location: LocationInformation

    @Environment(\.openURL) private var openURL

    private var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: location.latitude, longitude: location.longitude)
    }

    var body: some View {
        Button {
            if let url = URL(string: location.googleMapsURL), !location.googleMapsURL.isEmpty {
                openURL(url)
            }
        } label: {
            Map(initialPosition: .camera(
                MapCamera(
                    centerCoordinate: coordinate,
                    distance: 350,
                    heading: 30,
                    pitch: 75
                )
            )) {
                Annotation(location.name, coordinate: coordinate) {
                    PulsingBeacon()
                }
            }
            .mapStyle(.standard(elevation: .realistic, pointsOfInterest: .excludingAll))
            .allowsHitTesting(false)
            .frame(height: 240)
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .overlay(alignment: .bottomTrailing) {
                HStack(spacing: 5) {
                    Text("Open in Maps")
                    Image(systemName: "arrow.up.right")
                }
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Color("AppPrimaryText"))
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .liquidGlass(in: Capsule())
                .padding(12)
            }
            .shadow(color: .black.opacity(0.15), radius: 12, y: 6)
        }
        .buttonStyle(PressableButtonStyle())
        // The Map wraps the whole button; collapse its internals into one
        // spoken action rather than reading map/annotation contents.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Open \(location.name) in Maps")
    }
}

private struct PulsingBeacon: View {
    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: 2.2) / 2.2

            ZStack {
                Circle()
                    .stroke(Color("AppPrimary").opacity(1 - t), lineWidth: 1.5)
                    .frame(width: 14 + 38 * t, height: 14 + 38 * t)

                Circle()
                    .fill(Color("AppPrimary"))
                    .frame(width: 13, height: 13)
                    .overlay(Circle().strokeBorder(.white, lineWidth: 2.5))
                    .shadow(color: .black.opacity(0.3), radius: 3, y: 1)
            }
            .frame(width: 52, height: 52)
        }
    }
}

// MARK: - QuestTransportOptions
struct QuestTransportOptions: View {
    let options: [TransportationOption]

    private var validOptions: [TransportationOption] {
        options.filter { $0.estimatedTravelMinutes > 0 }
    }

    var body: some View {
        if !validOptions.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                MicroLabel(text: "Getting there")

                FlowLayout(spacing: 10) {
                    ForEach(validOptions, id: \.mode) { option in
                        entry(for: option)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func entry(for option: TransportationOption) -> some View {
        HStack(spacing: 5) {
            Image(systemName: option.mode.systemIconName)
                .font(.caption)
            Text("\(option.estimatedTravelMinutes) min")
                .font(.caption)
                .fontWeight(option.isRecommended ? .semibold : .regular)
        }
        .foregroundStyle(
            option.isRecommended ? Color("AppPrimary") : Color("AppSecondaryText")
        )
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(
            option.isRecommended
                ? AnyShapeStyle(Color("AppPrimary").opacity(0.12))
                : AnyShapeStyle(.clear),
            in: Capsule()
        )
        .overlay(
            Capsule().strokeBorder(
                option.isRecommended
                    ? Color("AppPrimary").opacity(0.35)
                    : Color("AppSecondaryText").opacity(0.2),
                lineWidth: 1
            )
        )
    }
}

// MARK: - QuestTrailDivider
struct QuestTrailDivider: View {
    let location: LocationInformation

    private var recommended: TransportationOption? {
        location.transportationOptions.first(where: \.isRecommended)
    }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1 / 30)) { timeline in
            let time = timeline.date.timeIntervalSinceReferenceDate
            let phase = -CGFloat(time.truncatingRemainder(dividingBy: 1.3) / 1.3) * 9

            HStack(spacing: 12) {
                Image(systemName: recommended?.mode.systemIconName ?? "figure.walk")
                    .font(.footnote)
                    .foregroundStyle(Color("AppSecondaryText"))

                trailLine(phase: phase)

                if let journeyLabel {
                    Text(journeyLabel)
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(Color("AppSecondaryText"))
                        .fixedSize()

                    trailLine(phase: phase)
                }

                Image(systemName: "mappin.and.ellipse")
                    .font(.footnote)
                    .foregroundStyle(Color("AppPrimary"))
            }
        }
    }

    private var journeyLabel: String? {
        var parts: [String] = []
        if let distance = location.formattedDistanceMiles {
            parts.append(distance)
        }
        if let recommended, recommended.estimatedTravelMinutes > 0 {
            parts.append("\(recommended.estimatedTravelMinutes) min")
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private func trailLine(phase: CGFloat) -> some View {
        TrailLine()
            .stroke(
                Color("AppSecondaryText").opacity(0.45),
                style: StrokeStyle(
                    lineWidth: 1.5,
                    lineCap: .round,
                    dash: [1.5, 7.5],
                    dashPhase: phase
                )
            )
            .frame(height: 1.5)
    }
}

private struct TrailLine: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.minX, y: rect.midY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        return path
    }
}
