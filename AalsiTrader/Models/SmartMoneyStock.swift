import Foundation

struct SmartMoneyStock: Codable, Identifiable {
    var id: String { symbol }
    let symbol: String
    let price: Double
    let trendStrength: Double
    let confidence: Double
    let structure: MarketStructure
    let signal: StockSignal
    let rsi: Double
    let momentum5d: Double?
    let trend: String?
    let volumeSurge: Bool?
    let support: Double?
    let resistance: Double?
    let sma20: Double?
    let sma50: Double?
}

enum MarketStructure: String, Codable {
    case BOS_BULLISH
    case BOS_BEARISH
    case CHOCH_BULLISH
    case CHOCH_BEARISH
    case RANGE

    var displayName: String {
        switch self {
        case .BOS_BULLISH: return "BOS Bull"
        case .BOS_BEARISH: return "BOS Bear"
        case .CHOCH_BULLISH: return "CHoCH Bull"
        case .CHOCH_BEARISH: return "CHoCH Bear"
        case .RANGE: return "Range"
        }
    }

    var isBullish: Bool {
        self == .BOS_BULLISH || self == .CHOCH_BULLISH
    }
}

enum StockSignal: String, Codable {
    case BUY
    case SELL
    case NEUTRAL
}

struct CandleData: Codable, Identifiable {
    var id: String { "\(timestamp)" }
    let timestamp: Double
    let open: Double
    let high: Double
    let low: Double
    let close: Double
    let volume: Double?

    var date: Date {
        Date.fromEpoch(timestamp)
    }
}
