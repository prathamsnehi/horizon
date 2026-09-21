//
//  CompletedGallerySection.swift
//  horizon
//
//  Photo log for a completed quest, editable in the page's Edit mode.
//  Bytes live on the model (journalPhotoData), so edits sync to iCloud.
//

import SwiftUI
import PhotosUI

struct CompletedGallerySection: View {
    @Bindable var quest: Quest
    let isEditing: Bool

    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showCamera = false

    private let columns = [GridItem(.adaptive(minimum: 96), spacing: 10)]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Eyebrow(text: "The Gallery", color: Color("AppPrimary"), number: "01")

            if !quest.journalPhotoData.isEmpty {
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(Array(quest.journalPhotoData.enumerated()), id: \.offset) { index, data in
                        if let image = PhotoCache.image(for: data) {
                            RemovablePhotoThumbnail(
                                image: image,
                                onRemove: isEditing ? { remove(at: index) } : nil
                            )
                        }
                    }
                }
            }

            if isEditing {
                HStack(spacing: 10) {
                    PhotosPicker(
                        selection: $pickerItems,
                        maxSelectionCount: 8,
                        matching: .images
                    ) {
                        PhotoSourceLabel(icon: "photo.on.rectangle.angled", text: "Add photos")
                    }
                    .buttonStyle(PressableButtonStyle())

                    if CameraPicker.isAvailable {
                        Button {
                            showCamera = true
                        } label: {
                            PhotoSourceLabel(icon: "camera", text: "Take photo")
                        }
                        .buttonStyle(PressableButtonStyle())
                    }
                }
            }
        }
        .onChange(of: pickerItems) { _, items in
            guard !items.isEmpty else { return }
            Task {
                for item in items {
                    if let data = try? await item.loadTransferable(type: Data.self),
                       let image = UIImage(data: data) {
                        add(image)
                    }
                }
                pickerItems = []
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { add($0) }
                .ignoresSafeArea()
        }
    }

    private func add(_ image: UIImage) {
        guard let data = image.jpegData(compressionQuality: 0.85) else { return }
        quest.addJournalPhoto(data)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    private func remove(at index: Int) {
        quest.removeJournalPhoto(at: index)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}
