import Foundation

// MARK: - Engine Status
struct EngineStatus: Codable {
    let broker: BrokerStatus
    let market: MarketStatus
    let engine: EngineState
}

struct BrokerStatus: Codable {
    let connected: Bool
    var name: String?
    var label: String?
}

struct MarketStatus: Codable {
    let isOpen: Bool
    var istTime: String?
}

struct EngineState: Codable {
    let running: Bool
    var mode: TradingMode?
    var broker: String?
    var indexName: IndexName?
    var strategyType: StrategyType?
    var lastSpot: Double?
    var lastNiftySpot: Double?
    var lastUpdate: String?
}

enum TradingMode: String, Codable {
    case paper
    case live
}

enum IndexName: String, Codable {
    case NIFTY
    case BANKNIFTY
}

enum StrategyType: String, Codable {
    case short_straddle
    case short_strangle
    case iron_condor

    var displayName: String {
        switch self {
        case .short_straddle: return "Short Straddle"
        case .short_strangle: return "Short Strangle"
        case .iron_condor: return "Iron Condor"
        }
    }
}

// MARK: - Capital
struct StraddleCapital: Codable {
    let initialCapital: Double
    let currentCapital: Double
    let totalPnl: Double
    let maxDrawdownPct: Double
    let winRate: Double
    let totalTrades: Int
}

// MARK: - Position
struct StraddlePosition: Codable, Identifiable {
    let id: String
    var indexName: IndexName?
    var strategyType: StrategyType?
    var strategyLabel: String?
    var legs: [LegDetail]?
    var exitRules: ExitRules?
    let ceStrike: Double
    let peStrike: Double
    let ceEntryPremium: Double
    let peEntryPremium: Double
    var ceCurPremium: Double
    var peCurPremium: Double
    var ceDelta: Double?
    var peDelta: Double?
    let totalCollected: Double
    var totalCurrent: Double
    var unrealizedPnl: Double
    let niftyEntry: Double
    let entryTime: String
    let mode: TradingMode
    var broker: String?
    var ceOrderId: String?
    var peOrderId: String?
    var marginRequired: Double?
    var netMarginRequired: Double?
    var capitalUtilization: Double?
}

struct LegDetail: Codable, Identifiable {
    var id: String { "\(side)_\(strikePrice)" }
    let side: String  // CE or PE
    let action: String  // BUY or SELL
    let strikePrice: Double
    let entryPremium: Double
    var curPremium: Double
    var delta: Double?
    var instrumentId: String?
    var orderId: String?
}

struct ExitRules: Codable {
    var perLegSlPct: Double?
    let combinedSlPct: Double
    let profitTargetPct: Double
}

// MARK: - Straddle Trade
struct StraddleTrade: Codable, Identifiable {
    let id: String
    let tradeDate: String
    let strategyType: String
    var indexName: IndexName?
    let entryTime: String
    let exitTime: String
    let ceEntryPremium: Double
    let peEntryPremium: Double
    let ceExitPremium: Double
    let peExitPremium: Double
    let netPnl: Double
    var grossPnl: Double?
    let exitReason: String
    let mode: TradingMode
    var broker: String?
    var ceStrike: Double?
    var peStrike: Double?
    var niftyEntry: Double?
    var niftyExit: Double?
    var marginRequired: Double?
    var netMarginRequired: Double?
    var totalCollected: Double?
    var totalAtExit: Double?
    var lotSize: Int?
    var lots: Int?
    var legs: [LegDetail]?
}
