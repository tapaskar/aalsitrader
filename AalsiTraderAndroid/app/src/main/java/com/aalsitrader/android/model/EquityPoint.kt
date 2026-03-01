package com.aalsitrader.android.model

import kotlinx.serialization.Serializable

@Serializable
data class EquityPoint(
    val timestamp: Double = 0.0,
    val capital: Double = 0.0,
    val pnl: Double = 0.0,
    val drawdown: Double = 0.0,
    val openPositions: Int? = null,
    val formattedTime: String? = null,
    val formattedDate: String? = null,
)
