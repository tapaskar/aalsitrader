package com.aalsitrader.android.model

import kotlinx.serialization.Serializable

@Serializable
data class TradingConfig(
    val startingCapital: Double? = null,
    val maxRiskPerTradePct: Double? = null,
    val dailyLossLimitPct: Double? = null,
    val maxPositions: Int? = null,
    val maxSectorExposurePct: Double? = null,
    val rsiOversoldThreshold: Double? = null,
    val rsiOverboughtThreshold: Double? = null,
    val minRewardRiskRatio: Double? = null,
    val minTimeframeConfidence: Double? = null,
    val rejectHighFalseBreakout: Boolean? = null,
    val requireAgentAlignment: Boolean? = null,
    val maxTradeDurationHours: Int? = null,
    val exitOnMomentumExhaustion: Boolean? = null,
    val exitOnReversalSignal: Boolean? = null,
    val intradayExitTime: String? = null,
    val maxSwingHoldingDays: Int? = null,
    val hedgeEnabled: Boolean? = null,
    val brokeragePerOrder: Double? = null,
)

@Serializable
data class TradingRules(
    val userId: String? = null,
    val entryRules: List<String>? = null,
    val exitRules: List<String>? = null,
    val riskRules: List<String>? = null,
    val config: TradingConfig? = null,
    val lastUpdated: String? = null,
    val updatedBy: String? = null,
)
