import Foundation

enum StraddleService {
    struct StatusResponse: Decodable {
        let status: EngineStatus?
        let broker: BrokerStatus?
        let market: MarketStatus?
        let engine: EngineState?

        var engineStatus: EngineStatus {
            if let status { return status }
            return EngineStatus(
                broker: broker ?? BrokerStatus(connected: false),
                market: market ?? MarketStatus(isOpen: false),
                engine: engine ?? EngineState(running: false)
            )
        }
    }

    struct CapitalResponse: Decodable {
        let capital: StraddleCapital
    }

    struct PositionResponse: Decodable {
        let position: StraddlePosition?
    }

    struct TradesResponse: Decodable {
        let trades: [StraddleTrade]
    }

    struct ActionResponse: Decodable {
        let message: String?
        let success: Bool?
    }

    static func fetchStatus() async throws -> EngineStatus {
        let response: StatusResponse = try await APIClient.shared.get("/nifty-straddle/status")
        return response.engineStatus
    }

    static func fetchCapital(mode: String = "paper") async throws -> StraddleCapital {
        let response: CapitalResponse = try await APIClient.shared.get(
            "/nifty-straddle/capital",
            queryItems: [URLQueryItem(name: "mode", value: mode)]
        )
        return response.capital
    }

    static func fetchPosition(mode: String = "paper") async throws -> StraddlePosition? {
        let response: PositionResponse = try await APIClient.shared.get(
            "/nifty-straddle/current",
            queryItems: [URLQueryItem(name: "mode", value: mode)]
        )
        return response.position
    }

    static func fetchTrades(from: String? = nil, to: String? = nil) async throws -> [StraddleTrade] {
        var queryItems: [URLQueryItem] = []
        if let from { queryItems.append(URLQueryItem(name: "from", value: from)) }
        if let to { queryItems.append(URLQueryItem(name: "to", value: to)) }
        let response: TradesResponse = try await APIClient.shared.get(
            "/nifty-straddle/trades",
            queryItems: queryItems.isEmpty ? nil : queryItems
        )
        return response.trades
    }

    static func startEngine() async throws -> ActionResponse {
        try await APIClient.shared.post("/nifty-straddle/start", body: [:])
    }

    static func stopEngine() async throws -> ActionResponse {
        try await APIClient.shared.post("/nifty-straddle/stop")
    }

    static func setMode(_ mode: TradingMode) async throws -> ActionResponse {
        try await APIClient.shared.post("/nifty-straddle/mode", body: ["mode": mode.rawValue])
    }
}
