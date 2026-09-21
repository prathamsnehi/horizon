//
//  CompletedPlaceSection.swift
//  horizon
//
//  Where this quest happened: photo, address, map, editorial note. No
//  travel logistics — the journey is already done.
//

import SwiftUI

struct CompletedPlaceSection: View {
    let location: LocationInformation
    let photoData: Data?

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Eyebrow(text: "The Place", color: Color("AppPrimary"), number: "03")

            Color.clear
                .frame(height: 170)
                .overlay {
                    HeroImageView(photoData: photoData)
                }
                .clipShape(RoundedRectangle(cornerRadius: 18))

            VStack(alignment: .leading, spacing: 3) {
                Text(location.name)
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundStyle(Color("AppPrimaryText"))
                Text(location.address)
                    .font(.footnote)
                    .foregroundStyle(Color("AppSecondaryText"))
            }

            QuestMapCard(location: location)
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
