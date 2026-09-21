//
//  AnonymousSession.swift
//  horizon
//
//  The app's identity, without ever asking for one: a Firebase anon session
//  minted on the first call. The security boundary is documented in the root
//  backend and API references.
//

import Foundation
import FirebaseAuth

/// Serialises session creation: both generation lanes can fire at once,
/// and two concurrent `signInAnonymously()` calls would race.
actor AnonymousSession {
    static let shared = AnonymousSession()

    /// The in-flight sign-in, so callers that arrive mid-flight await the
    /// same one instead of starting another.
    private var pending: Task<Void, Error>?

    /// Returns once a session exists. Throws whatever Firebase threw —
    /// CloudFunctionService maps it alongside the callable's own errors,
    /// so an offline first launch reads as offline.
    func ensure() async throws {
        // The session persists in the keychain, so this is the path
        // taken on every launch after the first.
        if Auth.auth().currentUser != nil { return }

        if let pending {
            try await pending.value
            return
        }

        let task = Task {
            _ = try await Auth.auth().signInAnonymously()
        }
        pending = task
        defer { pending = nil }

        try await task.value
    }
}
