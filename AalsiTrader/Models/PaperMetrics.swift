import Foundation

struct PaperMetrics: Codable {
    let totalTrades: Int
    let winningTrades: Int
    let losingTrades: Int
    let winRate: Double
    let grossProfit: Double
    let grossLoss: Double
    let netPnL: Double
    let avgWin: Double
    let avgLoss: Double
    let largestWin: Double
    let largestLoss: Double
    let profitFactor: Double
    let maxDrawdown: Double
    let sharpeRatio: Double
    let sortinoRatio: Double
    let calmarRatio: Double
    let totalReturn: Double
    let annualizedReturn: Double
    let avgTradeDuration: String?
    let bestPerformingSymbol: String?
    let worstPerformingSymbol: String?
    let eligibleForLive: Bool?
    let tradesRemaining: Int?
    let recommendations: [String]?
    let expectancy: Double?
}
