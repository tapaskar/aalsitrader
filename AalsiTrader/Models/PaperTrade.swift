import Foundation

struct PaperTrade: Codable, Identifiable {
    let id: String
    let symbol: String
    let signal: TradeSignal
    let status: TradeStatus
    let entryTime: ActivityTimestamp
    var exitTime: ActivityTimestamp?
    let entryPrice: Double
    var exitPrice: Double?
    var exitReason: ExitReason?
    let futuresLots: Int?
    let optionLots: Int?
    let lotSize: Int?
    let atmStrike: Double?
    let optionType: OptionType?
    let optionEntryPrice: Double?
    var optionExitPrice: Double?
    var optionExpiry: String?
    let marginUsed: Double?
    let hedgeCost: Double?
    let initialRisk: Double?
    let maxLoss: Double?
    var grossPnL: Double?
    var hedgePnL: Double?
    var netPnL: Double?
    var pnlPercent: Double?
    let brokerage: Double?
    let stt: Double?
    let transactionCharges: Double?
    let gst: Double?
    let totalCharges: Double?
    var indicators: PaperTradeIndicators?
    var duration: String?
}

enum TradeSignal: String, Codable {
    case BUY
    case SELL
}

enum ExitReason: String, Codable {
    case target
    case stoploss
    case momentum_exhaustion
    case reversal
    case manual
    case expiry
}

enum OptionType: String, Codable {
    case CE
    case PE
}

struct PaperTradeIndicators: Codable {
    var rsi: Double?
    var macd: Double?
    var trend: String?
    var signal: String?
    var confidence: Double?
}
