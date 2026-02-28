import Foundation

struct TradingConfig: Codable {
    var startingCapital: Double?
    var maxRiskPerTradePct: Double?
    var dailyLossLimitPct: Double?
    var maxPositions: Int?
    var maxSectorExposurePct: Double?
    var rsiOversoldThreshold: Double?
    var rsiOverboughtThreshold: Double?
    var minRewardRiskRatio: Double?
    var minTimeframeConfidence: Double?
    var rejectHighFalseBreakout: Bool?
    var requireAgentAlignment: Bool?
    var maxTradeDurationHours: Int?
    var exitOnMomentumExhaustion: Bool?
    var exitOnReversalSignal: Bool?
    var intradayExitTime: String?
    var maxSwingHoldingDays: Int?
    var hedgeEnabled: Bool?
    var brokeragePerOrder: Double?
}

struct TradingRules: Codable {
    let userId: String?
    var entryRules: [String]?
    var exitRules: [String]?
    var riskRules: [String]?
    var config: TradingConfig?
    var lastUpdated: String?
    var updatedBy: String?
}
