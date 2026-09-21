//
//  LogbookEmptyView.swift
//  horizon
//
//  Calm empty state for the logbook.
//

import SwiftUI

struct LogbookEmptyView: View {
    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "book.closed")
                .font(.largeTitle)
                .foregroundStyle(Color("AppPrimary"))

            Text("No stories yet.")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundStyle(Color("AppPrimaryText"))

            Text("Complete your first quest and it will live here.")
                .font(.subheadline)
                .foregroundStyle(Color("AppSecondaryText"))
                .multilineTextAlignment(.center)
        }
        .padding(40)
    }
}
