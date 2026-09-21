//
//  CompletionPhotoSection.swift
//  horizon
//
//  Photo evidence for the completion form: thumbnails with remove buttons,
//  plus library and camera sources. At least one photo is required.
//

import SwiftUI
import PhotosUI

struct CompletionPhotoSection: View {
    @Bindable var model: CompletionFlowModel

    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var showCamera = false

    private let columns = [GridItem(.adaptive(minimum: 96), spacing: 10)]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Eyebrow(text: "The Evidence", color: Color("AppPrimary"), number: "01")

            Text("Add at least one photo from the quest.")
                .font(.subheadline)
                .foregroundStyle(Color("AppSecondaryText"))

            if !model.pickedImages.isEmpty {
                LazyVGrid(columns: columns, spacing: 10) {
                    ForEach(Array(model.pickedImages.enumerated()), id: \.offset) { index, image in
                        RemovablePhotoThumbnail(image: image) {
                            model.removeImage(at: index)
                        }
                    }
                }
            }

            HStack(spacing: 10) {
                PhotosPicker(
                    selection: $pickerItems,
                    maxSelectionCount: 8,
                    matching: .images
                ) {
                    PhotoSourceLabel(icon: "photo.on.rectangle.angled", text: "Library")
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
        .onChange(of: pickerItems) { _, items in
            guard !items.isEmpty else { return }
            Task {
                await model.loadPickedItems(items)
                pickerItems = []
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { model.add($0) }
                .ignoresSafeArea()
        }
    }
}
