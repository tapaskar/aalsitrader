import Foundation

enum BrokerPortfolioService {
    static func fetchPortfolio() async throws -> BrokerPortfolio {
        try await APIClient.shared.get("/broker-portfolio")
    }
}
