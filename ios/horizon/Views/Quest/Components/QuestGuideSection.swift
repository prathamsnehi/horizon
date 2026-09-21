import SwiftUI

// MARK: - QuestGuideSection
struct QuestGuideSection: View {
    let number: String

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Eyebrow(text: "Field Guide", number: number)

            GetStartedCard()
        }
    }
}

// MARK: - GetStartedCard
/// A passive teaser for v1 — the step-by-step guide ships in v2. No
/// chevron or button: it must read as "coming soon," not a broken row.
struct GetStartedCard: View {
    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "sparkles")
                .font(.title3)
                .foregroundStyle(Color("AppPrimary"))

            Text("A step-by-step guide for this quest")
                .font(.subheadline)
                .foregroundStyle(Color("AppSecondaryText"))

            Spacer(minLength: 12)

            Text("Coming soon")
                .font(.caption2)
                .fontWeight(.semibold)
                .foregroundStyle(Color("AppSecondaryText"))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(
                    Capsule().fill(Color("AppSecondaryText").opacity(0.12))
                )
        }
    }
}
