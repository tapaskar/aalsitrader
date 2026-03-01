package com.aalsitrader.android.model

import kotlinx.serialization.Serializable

@Serializable
data class PaperPortfolio(
    val capital: Double = 0.0,
    val startingCapital: Double = 0.0,
    val availableCapital: Double = 0.0,
    val marginUsed: Double = 0.0,
    val totalPnl: Double = 0.0,
    val unrealizedPnl: Double = 0.0,
    val dayPnl: Double = 0.0,
    val openPositions: Int = 0,
    val closedTrades: Int? = null,
    val winRate: Double = 0.0,
    val maxDrawdown: Double = 0.0,
    val peakCapital: Double? = null,
    val lastUpdated: ActivityTimestamp? = null,
)
