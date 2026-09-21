//
//  ValidationLimits.swift
//  horizon
//
//  Client mirror of the backend's input caps, enforced wherever the app
//  builds a request. Keep in sync with the backend constants.
//

import Foundation

enum ValidationLimits {
    static let describePromptChars = 300
    static let profileArrayItems = 50
    static let profileStringChars = 120
    static let additionalContextChars = 500
    static let excludeTitles = 100
}
