//
//  CompletionFlowModel.swift
//  horizon
//
//  State for the completion form. Nothing touches the quest until
//  complete(quest:) — dismissing the form beforehand changes nothing.
//

import SwiftUI
import PhotosUI

@Observable
@MainActor
final class CompletionFlowModel {
    var pickedImages: [UIImage] = []
    var journalText = ""
    var errorMessage: String?

    /// At least one photo is required to complete a quest.
    var canComplete: Bool { !pickedImages.isEmpty }

    func add(_ image: UIImage) {
        pickedImages.append(image)
    }

    func removeImage(at index: Int) {
        guard pickedImages.indices.contains(index) else { return }
        pickedImages.remove(at: index)
    }

    func loadPickedItems(_ items: [PhotosPickerItem]) async {
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data) {
                pickedImages.append(image)
            }
        }
    }

    /// The single place a quest becomes .completed. Returns true when
    /// everything is saved and the status flip happened.
    func complete(quest: Quest) -> Bool {
        guard canComplete else { return false }

        let photoData = pickedImages.compactMap { $0.jpegData(compressionQuality: 0.85) }
        guard !photoData.isEmpty else {
            errorMessage = "Couldn't save your photos. Please try again."
            return false
        }

        let trimmed = journalText.trimmingCharacters(in: .whitespacesAndNewlines)
        quest.markCompleted(journal: trimmed.isEmpty ? nil : trimmed, photoData: photoData)

        UINotificationFeedbackGenerator().notificationOccurred(.success)
        return true
    }
}
