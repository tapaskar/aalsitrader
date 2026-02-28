import Foundation

enum PaperTradingService {
    struct PortfolioResponse: Decodable {
        let portfolio: PaperPortfolio
    }

    struct TradesResponse: Decodable {
        let trades: [PaperTrade]
    }

    struct EquityCurveResponse: Decodable {
        let equityCurve: [EquityPoint]?
        let curve: [EquityPoint]?

        var points: [EquityPoint] {
            equityCurve ?? curve ?? []
        }
    }

    struct ApprovalsResponse: Decodable {
        let approvals: [SigmaApproval]?
        let pending: [SigmaApproval]?

        var items: [SigmaApproval] {
            approvals ?? pending ?? []
        }
    }

    struct ModeResponse: Decodable {
        let mode: String?
        let enabled: Bool?
        let requireSigmaApproval: Bool?
        let autoTradingEnabled: Bool?
    }

    static func fetchPortfolio(mode: String = "paper") async throws -> PaperPortfolio {
        let response: PortfolioResponse = try await APIClient.shared.get(
            "/paper-portfolio",
            queryItems: [URLQueryItem(name: "mode", value: mode)]
        )
        return response.portfolio
    }

    static func fetchTrades(mode: String = "paper", limit: Int = 100) async throws -> [PaperTrade] {
        let response: TradesResponse = try await APIClient.shared.get(
            "/paper-trades",
            queryItems: [
                URLQueryItem(name: "limit", value: "\(limit)"),
                URLQueryItem(name: "mode", value: mode)
            ]
        )
        return response.trades
    }

    static func fetchMetrics(mode: String = "paper") async throws -> PaperMetrics {
        try await APIClient.shared.get(
            "/paper-metrics",
            queryItems: [URLQueryItem(name: "mode", value: mode)]
        )
    }

    static func fetchEquityCurve(days: Int = 30, mode: String = "paper") async throws -> [EquityPoint] {
        let response: EquityCurveResponse = try await APIClient.shared.get(
            "/paper-equity-curve",
            queryItems: [
                URLQueryItem(name: "days", value: "\(days)"),
                URLQueryItem(name: "mode", value: mode)
            ]
        )
        return response.points
    }

    static func fetchApprovals() async throws -> [SigmaApproval] {
        let response: ApprovalsResponse = try await APIClient.shared.get("/sigma-approvals")
        return response.items
    }

    static func approveTradeSignal(_ tradeId: String) async throws {
        try await APIClient.shared.postVoid("/sigma-approvals/\(tradeId)/approve")
    }

    static func rejectTradeSignal(_ tradeId: String) async throws {
        try await APIClient.shared.postVoid("/sigma-approvals/\(tradeId)/reject")
    }

    static func fetchMode() async throws -> ModeResponse {
        try await APIClient.shared.get("/paper-mode")
    }

    static func setMode(body: [String: Any]) async throws -> ModeResponse {
        try await APIClient.shared.post("/paper-mode", body: body)
    }
}
