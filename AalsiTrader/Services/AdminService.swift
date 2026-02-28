import Foundation

enum AdminService {
    struct UsersResponse: Decodable {
        let users: [User]
    }

    struct SystemStats: Decodable {
        let totalUsers: Int
        let activeLastDay: Int
        let planBreakdown: [String: Int]?
        let liveTraders: Int
        let trialUsers: Int
    }

    static func fetchUsers() async throws -> [User] {
        let response: UsersResponse = try await APIClient.shared.get("/admin/users")
        return response.users
    }

    static func fetchStats() async throws -> SystemStats {
        try await APIClient.shared.get("/admin/stats")
    }

    static func updatePlan(email: String, plan: PlanType, planStatus: PlanStatus) async throws {
        try await APIClient.shared.putVoid("/admin/users/\(email)/plan", body: [
            "plan": plan.rawValue,
            "planStatus": planStatus.rawValue
        ])
    }

    static func updateTrial(email: String, days: Int) async throws {
        try await APIClient.shared.putVoid("/admin/users/\(email)/trial", body: [
            "days": days
        ])
    }

    static func updateTrading(email: String, enabled: Bool) async throws {
        try await APIClient.shared.putVoid("/admin/users/\(email)/trading", body: [
            "liveTradingEnabled": enabled
        ])
    }

    static func updateAccount(email: String, enabled: Bool) async throws {
        try await APIClient.shared.putVoid("/admin/users/\(email)/account", body: [
            "accountEnabled": enabled
        ])
    }

    static func deleteUser(email: String) async throws {
        try await APIClient.shared.deleteVoid("/admin/users/\(email)")
    }
}
