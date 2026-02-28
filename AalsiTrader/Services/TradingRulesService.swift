import Foundation

enum TradingRulesService {
    static func fetchRules() async throws -> TradingRules {
        try await APIClient.shared.get("/trading-rules")
    }

    static func saveRules(config: TradingConfig, entryRules: [String], exitRules: [String], riskRules: [String]) async throws -> TradingRules {
        var body: [String: Any] = [:]

        // Build config dictionary
        var configDict: [String: Any] = [:]
        if let v = config.startingCapital { configDict["startingCapital"] = v }
        if let v = config.maxRiskPerTradePct { configDict["maxRiskPerTradePct"] = v }
        if let v = config.dailyLossLimitPct { configDict["dailyLossLimitPct"] = v }
        if let v = config.maxPositions { configDict["maxPositions"] = v }
        if let v = config.maxSectorExposurePct { configDict["maxSectorExposurePct"] = v }
        if let v = config.rsiOversoldThreshold { configDict["rsiOversoldThreshold"] = v }
        if let v = config.rsiOverboughtThreshold { configDict["rsiOverboughtThreshold"] = v }
        if let v = config.minRewardRiskRatio { configDict["minRewardRiskRatio"] = v }
        if let v = config.minTimeframeConfidence { configDict["minTimeframeConfidence"] = v }
        if let v = config.rejectHighFalseBreakout { configDict["rejectHighFalseBreakout"] = v }
        if let v = config.requireAgentAlignment { configDict["requireAgentAlignment"] = v }
        if let v = config.maxTradeDurationHours { configDict["maxTradeDurationHours"] = v }
        if let v = config.exitOnMomentumExhaustion { configDict["exitOnMomentumExhaustion"] = v }
        if let v = config.exitOnReversalSignal { configDict["exitOnReversalSignal"] = v }
        if let v = config.intradayExitTime { configDict["intradayExitTime"] = v }
        if let v = config.maxSwingHoldingDays { configDict["maxSwingHoldingDays"] = v }
        if let v = config.hedgeEnabled { configDict["hedgeEnabled"] = v }
        if let v = config.brokeragePerOrder { configDict["brokeragePerOrder"] = v }

        body["config"] = configDict
        body["rules"] = [
            "entry": entryRules,
            "exit": exitRules,
            "risk": riskRules
        ]

        return try await APIClient.shared.put("/trading-rules", body: body)
    }
}
