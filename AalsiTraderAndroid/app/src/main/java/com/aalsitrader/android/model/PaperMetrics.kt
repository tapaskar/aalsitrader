package com.aalsitrader.android.model

import kotlinx.serialization.Serializable

@Serializable
data class PaperMetrics(
    val totalTrades: Int = 0,
    val winningTrades: Int = 0,
    val losingTrades: Int = 0,
    val winRate: Double = 0.0,
    val grossProfit: Double = 0.0,
    val grossLoss: Double = 0.0,
    val netPnL: Double = 0.0,
    val avgWin: Double = 0.0,
    val avgLoss: Double = 0.0,
    val largestWin: Double = 0.0,
    val largestLoss: Double = 0.0,
    val profitFactor: Double = 0.0,
    val maxDrawdown: Double = 0.0,
    val sharpeRatio: Double = 0.0,
    val sortinoRatio: Double = 0.0,
    val calmarRatio: Double = 0.0,
    val totalReturn: Double = 0.0,
    val annualizedReturn: Double = 0.0,
    val avgTradeDuration: String? = null,
    val bestPerformingSymbol: String? = null,
    val worstPerformingSymbol: String? = null,
    val eligibleForLive: Boolean? = null,
    val tradesRemaining: Int? = null,
    val recommendations: List<String>? = null,
    val expectancy: Double? = null,
)
