import Foundation

enum DashboardService {
    struct ActivitiesResponse: Decodable {
        let activities: [Activity]
    }

    struct CommsResponse: Decodable {
        let comms: [CommMessage]
    }

    struct StatsResponse: Decodable {
        let stats: SquadStats?
    }

    static func fetchActivities() async throws -> [Activity] {
        let response: ActivitiesResponse = try await APIClient.shared.get("/activities", requiresAuth: false)
        return response.activities
    }

    static func fetchComms() async throws -> [CommMessage] {
        let response: CommsResponse = try await APIClient.shared.get("/comms", requiresAuth: false)
        return response.comms
    }

    static func fetchMarketData() async throws -> MarketDataResponse {
        try await APIClient.shared.get("/market-data", requiresAuth: false)
    }
}

struct SquadStats: Codable {
    let totalTrades: Int?
    let winRate: Double?
    let totalPnl: Double?
    let avgRMultiple: Double?
    let bestTrade: Double?
    let worstTrade: Double?
    let activeAgents: Int?
    let sleepingAgents: Int?
}
