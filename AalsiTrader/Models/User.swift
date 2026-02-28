import Foundation

struct User: Codable {
    let email: String
    var username: String
    var role: UserRole
    var createdAt: Double?
    var updatedAt: Double?
    var lastLogin: Double?
    var brokerType: BrokerType?
    var hasZerodhaCredentials: Bool?
    var hasMotilalCredentials: Bool?
    var hasDhanCredentials: Bool?
    var hasAngelOneCredentials: Bool?
    var hasUpstoxCredentials: Bool?
    var plan: PlanType?
    var planStatus: PlanStatus?
    var trialStartedAt: String?
    var trialEndsAt: String?
    var liveTradingEnabled: Bool?
    var accountEnabled: Bool?
    var capitalLimit: Double?
    var lastActive: Double?
    var emailOptOut: Bool?
    var settings: UserSettings?

    var isAdmin: Bool {
        role == .admin
    }
}

enum UserRole: String, Codable {
    case user
    case admin
}

enum BrokerType: String, Codable {
    case zerodha
    case motilal
    case dhan
    case angelone
    case upstox
    case none
}

enum PlanType: String, Codable {
    case starter
    case pro
    case premium
}

enum PlanStatus: String, Codable {
    case active
    case trial
    case expired
    case cancelled
}

struct UserSettings: Codable {
    var soundEnabled: Bool
    var darkMode: Bool
    var requireSigmaApproval: Bool
}
