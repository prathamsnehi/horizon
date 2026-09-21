//
//  EmptyQuestView.swift
//  horizon
//
//  Quest tab empty state — an invitation, not a dead end. Breathing
//  compass and a CTA into Explore.
//

import SwiftUI

/// Just a static view that points to going to the explore tab to view more quests
struct EmptyQuestView: View {
    @Binding var selectedTab: MainTabView.AppTab

    var body: some View {
        ZStack {
            AmbientBackground()
            
            VStack(spacing: 20) {
                
                Image(systemName: "safari.fill")
                    .font(.system(size: 64))
                    .foregroundStyle(.primaryCTA)

                VStack(spacing: 10) {
                    Eyebrow(text: "No Active Quest", color: Color("AppPrimary"))

                    Text("Your next story awaits.")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .foregroundStyle(Color("AppPrimaryText"))
                        .multilineTextAlignment(.center)

                    Text("Head to Explore and choose the quest\nyou'll pour yourself into.")
                        .font(.body)
                        .foregroundStyle(Color("AppSecondaryText"))
                        .multilineTextAlignment(.center)
                }

                Button {
                    selectedTab = .explore
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "sparkles")
                        Text("Explore Quests")
                    }
                    .font(.headline)
                    .foregroundStyle(.black)
                    .padding(.horizontal, 36)
                    .padding(.vertical, 16)
                    .background(.primaryCTA, in: Capsule())
                }
                .buttonStyle(PressableButtonStyle())
                .padding(.top, 10)
            }
            .padding(32)
        }
    }
}
