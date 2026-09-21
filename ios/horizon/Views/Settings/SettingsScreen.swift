//
//  SettingsScreen.swift
//  horizon
//
//  The profile editor, a sheet from the base card's "Tune your profile".
//  Edits live in a draft and reach the profile only on Save.
//

import SwiftUI
import SwiftData

struct SettingsScreen: View {
    let profile: UserProfile
    /// Signals a data wipe was confirmed. The actual delete runs from the
    /// presenter's sheet `onDismiss`, so no live view holds the deleted
    /// profile while the root swaps back to onboarding (that raced and crashed).
    let onRequestReset: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var model: SettingsScreenModel
    @State private var showDeleteConfirm = false

    init(profile: UserProfile, onRequestReset: @escaping () -> Void) {
        self.profile = profile
        self.onRequestReset = onRequestReset
        _model = State(initialValue: SettingsScreenModel(profile: profile))
    }

    var body: some View {
        ZStack {
            AmbientBackground()

            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: 36) {
                    header

                    EdgeSection(model: model)
                    HowFarSection(model: model)
                    DrawSection(model: model)
                    GroundSection(model: model)
                    DetailsSection(model: model)

                    DangerZone(onDelete: { showDeleteConfirm = true })
                        .padding(.top, 8)
                }
                .padding(.horizontal, 24)
                .padding(.top, 32)
                .padding(.bottom, 32)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .alert("Delete all data?", isPresented: $showDeleteConfirm) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                // Dismiss first; the presenter wipes on onDismiss.
                onRequestReset()
                dismiss()
            }
        } message: {
            Text("This permanently deletes your profile and every quest and logbook entry, and starts you over at onboarding. This can't be undone.")
        }
        .safeAreaInset(edge: .bottom) {
            SaveButton(isEnabled: model.canSave, action: saveAndDismiss)
                .padding(.horizontal, 24)
                .padding(.top, 32)
                .padding(.bottom, 12)
            // A tall clear→background fade instead of a framed bar, so
            // scrolling content dissolves into the page behind the
            // button rather than meeting a hard material edge.
                .background(
                    LinearGradient(colors: [Color("AppBackground").opacity(0), Color("AppBackground")],
                                   startPoint: .top,
                                   endPoint: .bottom
                                  )
                    .ignoresSafeArea()
                )
        }
    }
    
    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Eyebrow(text: "Settings", color: Color("AppPrimary"))
            
            Text("Tune your profile.")
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundStyle(Color("AppPrimaryText"))
            
            Text("Changes shape your next curated set — the cards you already have stay put.")
                .font(.subheadline)
                .foregroundStyle(Color("AppSecondaryText"))
        }
    }
    
    private func saveAndDismiss() {
        model.save(to: profile)
        dismiss()
    }
}

/// The start-over affordance. There is no account to delete (identity is
/// an invisible anonymous session), so this is offered on its own terms
/// rather than to satisfy a store rule — understated, and set apart from
/// the profile edits.
private struct DangerZone: View {
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Rectangle()
                .fill(Color("AppSecondaryText").opacity(0.15))
                .frame(height: 1)

            Eyebrow(text: "Start Over")

            Button(action: onDelete) {
                Text("Delete all data")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 4)
            }
            .buttonStyle(PressableButtonStyle())

            Text("Permanently removes your profile, quests, and logbook, and returns you to onboarding. This can't be undone.")
                .font(.footnote)
                .foregroundStyle(Color("AppSecondaryText"))
        }
    }
}

/// The pinned commit action, gated on the draft being valid.
private struct SaveButton: View {
    let isEnabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: "checkmark")
                Text("Save changes")
            }
            .primaryCapsule(isEnabled: isEnabled)
        }
        .buttonStyle(PressableButtonStyle())
        .disabled(!isEnabled)
    }
}

#Preview {
    SettingsScreen(profile: UserProfile(), onRequestReset: {})
}
