import SwiftUI

extension Color {
    // MARK: - Background & Surface
    static let appBackground = Color(red: 0.031, green: 0.031, blue: 0.063)    // #080810
    static let cardBackground = Color(red: 0.075, green: 0.075, blue: 0.165)   // #13132a
    static let cardHover = Color(red: 0.118, green: 0.118, blue: 0.227)        // #1e1e3a
    static let appBorder = Color(red: 0.227, green: 0.227, blue: 0.361)        // #3a3a5c

    // MARK: - Agent Colors
    static let alphaRed = Color(red: 1.0, green: 0.42, blue: 0.42)            // #ff6b6b
    static let betaTeal = Color(red: 0.306, green: 0.804, blue: 0.769)        // #4ecdc4
    static let gammaPurple = Color(red: 0.659, green: 0.333, blue: 0.969)     // #a855f7
    static let thetaOrange = Color(red: 0.976, green: 0.451, blue: 0.086)     // #f97316
    static let deltaBlue = Color(red: 0.231, green: 0.510, blue: 0.965)       // #3b82f6
    static let sigmaGreen = Color(red: 0.063, green: 0.725, blue: 0.506)      // #10b981

    // MARK: - Status Colors
    static let statusActive = Color(red: 0.0, green: 0.831, blue: 0.667)      // #00d4aa
    static let statusSleeping = Color(red: 0.420, green: 0.447, blue: 0.502)   // #6b7280
    static let statusWarning = Color(red: 0.961, green: 0.620, blue: 0.043)    // #f59e0b
    static let statusDanger = Color(red: 0.937, green: 0.267, blue: 0.267)     // #ef4444

    // MARK: - Accent
    static let accentCyan = Color(red: 0.0, green: 0.831, blue: 1.0)          // #00d4ff

    // MARK: - Text
    static let textPrimary = Color.white
    static let textSecondary = Color(red: 0.6, green: 0.6, blue: 0.7)
    static let textMuted = Color(red: 0.4, green: 0.4, blue: 0.5)

    // MARK: - P&L
    static let profitGreen = Color(red: 0.063, green: 0.725, blue: 0.506)     // #10b981
    static let lossRed = Color(red: 0.937, green: 0.267, blue: 0.267)         // #ef4444
}
