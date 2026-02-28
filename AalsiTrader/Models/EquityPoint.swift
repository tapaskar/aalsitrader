import Foundation

struct EquityPoint: Codable, Identifiable {
    var id: String { "\(timestamp)" }
    let timestamp: Double
    let capital: Double
    let pnl: Double
    let drawdown: Double
    let openPositions: Int?
    var formattedTime: String?
    var formattedDate: String?

    var date: Date {
        Date.fromEpoch(timestamp)
    }
}
