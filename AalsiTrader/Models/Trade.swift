import Foundation

struct Trade: Codable, Identifiable {
    let id: String
    let symbol: String
    let direction: TradeDirection
    let entryPrice: Double
    var exitPrice: Double?
    let stopLoss: Double
    let target: Double
    let status: TradeStatus
    var pnl: Double?
    var pnlPercent: Double?
    let setupType: String?
    let grade: TradeGrade?
    let entryTime: ActivityTimestamp
    var exitTime: ActivityTimestamp?
    let agentId: String?
    var notes: String?
}

enum TradeDirection: String, Codable {
    case long
    case short
}

enum TradeStatus: String, Codable {
    case open
    case closed
    case cancelled
}

enum TradeGrade: String, Codable {
    case A, B, C, D, F
}
