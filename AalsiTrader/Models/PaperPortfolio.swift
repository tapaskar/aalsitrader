import Foundation

struct PaperPortfolio: Codable {
    var capital: Double
    var startingCapital: Double
    var availableCapital: Double
    var marginUsed: Double
    var totalPnl: Double
    var unrealizedPnl: Double
    var dayPnl: Double
    var openPositions: Int
    var closedTrades: Int?
    var winRate: Double
    var maxDrawdown: Double
    var peakCapital: Double?
    var lastUpdated: ActivityTimestamp?
}
