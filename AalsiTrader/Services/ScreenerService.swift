import Foundation

enum ScreenerService {
    struct ScreenerResponse: Decodable {
        let stocks: [SmartMoneyStock]
        let fetchedAt: Double?
        let cached: Bool?
        let marketOpen: Bool?
    }

    struct ChartResponse: Decodable {
        let candles: [CandleData]
    }

    static func fetchStocks(force: Bool = false) async throws -> ScreenerResponse {
        var queryItems: [URLQueryItem] = []
        if force {
            queryItems.append(URLQueryItem(name: "force", value: "1"))
        }
        return try await APIClient.shared.get("/screener", queryItems: queryItems.isEmpty ? nil : queryItems, requiresAuth: false)
    }

    static func fetchChart(symbol: String) async throws -> [CandleData] {
        let response: ChartResponse = try await APIClient.shared.get(
            "/screener/chart",
            queryItems: [URLQueryItem(name: "symbol", value: symbol)],
            requiresAuth: false
        )
        return response.candles
    }
}
