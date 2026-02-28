import Foundation

struct SigmaApproval: Codable, Identifiable {
    var id: String { tradeId }
    let tradeId: String
    let symbol: String
    let signal: TradeSignal
    let entryPrice: Double
    let timestamp: ActivityTimestamp
    var status: ApprovalStatus
    var sigmaApprovedBy: String?
    var sigmaApprovedAt: ActivityTimestamp?
    var indicators: PaperTradeIndicators?
    var requiresApproval: Bool?

    var date: Date {
        timestamp.asDate
    }
}

enum ApprovalStatus: String, Codable {
    case pending
    case approved
    case rejected
}
